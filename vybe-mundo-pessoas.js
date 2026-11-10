// vybe-mundo-pessoas.js — o setor de Pessoas no Irecity (Paulo, 07/11/2026; inspirado no AgencyFlow).
//
//   VybePessoas.abrir(aba = 'produtividade' | 'rh' | 'projetos' | 'academy' | 'recrutamento' | 'documentos')  → Promise
//   VybePessoas.fechar()
//   VybePessoas.aberto()                                                       → boolean
//   VybePessoas.carga(semana?)  → Promise<{ semana, fim, capacidade, pessoas: [{ id, nome, pecas, atrasadas, etapas, total, pct, nivel }] }>
//                                 a carga atual por pessoa (demandas abertas do painel + etapas de projetos
//                                 da semana), para o Comercial cruzar capacidade × vendas.
//   VybePessoas.novoPedido()    → Promise  abre o RH já no formulário "Nova solicitação ao RH" (atalho do Hoje).
//   window.VybeEspiarProvedores.pessoas    os números da fila do RH (abertos, fora, respondidos) e o
//                                 histórico do clima no mini painel (data-espiar="pessoas:…").
//
// Os dados e as regras de acesso são do servidor (server/pessoas.js, GET/POST
// /api/painel?area=setor_pessoas); as contas são as de shared/pessoas-calculos.js. A tela só
// mostra o que o servidor mandou: quem não é dono nem administra não recebe ranking, pesos,
// metas, resultado do clima, recrutamento nem documentos — então nem há o que esconder aqui.
// O score sai 100% do que já passa pelo painel (prazo, volume, ajustes, atrasos): ninguém preenche nada.
// Celular primeiro: uma coluna, abas que rolam de lado, kanban e linha do tempo com rolagem própria.
(function () {
  'use strict';
  const ABAS = [['produtividade', 'Produtividade'], ['rh', 'Pedidos e calendário'], ['projetos', 'Projetos pontuais'], ['academy', 'Academy'], ['recrutamento', 'Recrutamento'], ['documentos', 'Documentos']];
  const SO_GESTAO = new Set(['recrutamento', 'documentos']);
  const ACIMA = '#cartao-rapido, #workflow-modal, #workspace-drawer, .brief-overlay, .etq-overlay, dialog[open], #login-gate, .vv-espiar';
  const URL_API = '/api/painel?area=setor_pessoas';
  const AJUDA = {
    produtividade: 'O score de 0 a 100 sai das demandas do painel, sem nada para preencher: entregas no prazo (a data do cliente manda), volume do mês contra a meta do cargo, peças que voltaram para ajuste e o que está atrasado na fila. Cada pessoa vê só o próprio detalhe; o ranking, a carga da semana, os pesos e as metas são dos donos. A carga da semana soma as demandas abertas do painel e as etapas de projeto de cada pessoa contra a capacidade semanal.',
    rh: 'Pedidos ao RH (férias ou folga, documento, reembolso, equipamento) com prazo de resposta em dias úteis por tipo, que os donos ajustam; fora do prazo fica em vermelho. O calendário do time mostra os aniversários (só dia e mês) e as férias e folgas aprovadas. A pesquisa de clima é aberta pelos donos com período e é anônima de verdade: a resposta não guarda quem respondeu nem a hora, e o resultado só aparece somado, com 3 respostas ou mais.',
    projetos: 'Projetos fora do mensal (evento, lançamento, site) com etapas, responsáveis e datas, na linha do tempo.',
    academy: 'Trilhas de treinamento para quem entra na Vybe. Cada aula é um link de vídeo ou documento; marque a aula como feita quando terminar. Os donos montam as trilhas e atribuem a cada pessoa.',
    recrutamento: 'Vagas abertas e os candidatos em cada etapa. As etapas são configuráveis; mover para Aprovado (ou Contratado) conta no tempo médio de contratação. Só os donos e quem administra veem.',
    documentos: 'Contratos e documentos de cada colaborador, com o aviso de renovação nos próximos 30 dias. Sem assinatura eletrônica: o link aponta para o arquivo no Drive. Só os donos e quem administra veem.',
  };
  const NIVEL = { sobrecarregada: ['Sobrecarregada', 'u2'], cheia: ['Cheia', 'u4'], ok: ['Em dia', 'u6'], leve: ['Folga', 'u5'] };
  const SLA = { atrasado: ['Fora do prazo', 'u1'], vence_hoje: ['Vence hoje', 'u2'], no_prazo: ['No prazo', 'u6'], encerrado: ['Encerrado', 'u5'], sem_prazo: ['Sem prazo', 'u5'] };
  const DOC = { vencido: ['Vencido', 'u1'], renovar: ['Renovar em breve', 'u2'], em_dia: ['Em dia', 'u6'], sem_renovacao: ['Sem renovação', 'u5'], encerrado: ['Encerrado', 'u5'] };
  const TIPOS_PROJETO = { evento: 'Evento', lancamento: 'Lançamento', site: 'Site', campanha: 'Campanha', outro: 'Outro' };
  const STATUS_PROJETO = { planejado: 'Planejado', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
  const estado = { raiz: null, janela: null, antes: null, aba: 'produtividade', dados: {}, carregando: false, erro: '', aviso: '', ajuda: false, form: '', editar: null,
    mes: '', pessoa: '', periodo: 'mensal', ref: '', semana: '', vaga: '', tipoPedido: '', filtroPedidos: '', pesquisaVer: '', calMes: '' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const br = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const opcoes = (mapa, atual) => Object.entries(mapa).map(([v, r]) => `<option value="${esc(v)}"${String(v) === String(atual ?? '') ? ' selected' : ''}>${esc(r)}</option>`).join('');
  const pessoasOpcoes = (lista, atual, vazio = 'Sem responsável') => `<option value="">${esc(vazio)}</option>` + (lista || []).map((p) => `<option value="${esc(p.id)}"${String(p.id) === String(atual ?? '') ? ' selected' : ''}>${esc(p.nome)}</option>`).join('');
  const chip = ([texto, cls]) => `<span class="vp-chip ${cls}">${esc(texto)}</span>`;
  const somarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

  // Gestão: o servidor diz (campo `gestao`); antes da primeira resposta, o palpite pelo nome.
  function gestao() {
    for (const d of Object.values(estado.dados)) if (d && typeof d.gestao === 'boolean') return d.gestao;
    if (typeof souAdmin === 'function' && souAdmin()) return true;
    // Palpite pela sessão (dono decidido no servidor, server/donos.js), nunca pelo primeiro nome.
    try { return typeof souDonoDaSessao === 'function' && souDonoDaSessao(); } catch { return false; }
  }

  // ---------- rede ----------
  async function pedir(metodo, consulta, corpo) {
    const qs = Object.entries(consulta || {}).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `&${k}=${encodeURIComponent(v)}`).join('');
    const r = await fetch(URL_API + qs, { method: metodo, credentials: 'same-origin', cache: 'no-store',
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined });
    let d = {}; try { d = await r.json(); } catch { /* resposta sem corpo */ }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Não foi possível falar com o servidor.'), { status: r.status });
    return d;
  }
  function consultaDa(aba) {
    if (aba === 'produtividade') return { aba, mes: estado.mes, pessoa: estado.pessoa };
    if (aba === 'rh' || aba === 'recrutamento') return { aba, periodo: estado.periodo, ref: estado.ref };
    if (aba === 'projetos') return { aba, semana: estado.semana };
    return { aba };
  }
  async function carregar(aba = estado.aba) {
    estado.carregando = true; estado.erro = ''; pintar();
    try { estado.dados[aba] = await pedir('GET', consultaDa(aba)); }
    catch (e) { estado.erro = e.message; if (e.status === 403 && SO_GESTAO.has(aba)) estado.dados[aba] = { proibido: true }; }
    finally { estado.carregando = false; pintar(); }
    // Folha do Vybe Finanças (só leitura, só donos; o servidor recusa os outros): chega depois e repinta.
    // Carga da semana (auditoria 09/11: saiu de Projetos pontuais e veio para a Produtividade, que é dos donos).
    if (aba === 'produtividade' && estado.dados.produtividade?.gestao) await carregarCarga();
    if (aba === 'rh' && gestao() && window.VybeFinancas?.carregar) await window.VybeFinancas.carregar('rh', mesFolha()).then(() => { if (estado.aba === 'rh') pintar(); });
  }
  async function carregarCarga() {
    try { const c = await pedir('GET', { aba: 'projetos', semana: estado.semanaCarga || '' }); if (estado.dados.produtividade) estado.dados.produtividade.cargaSemana = c; }
    catch { if (estado.dados.produtividade) estado.dados.produtividade.cargaSemana = { erro: true }; }
    if (estado.aba === 'produtividade') pintar();
  }
  async function gravar(corpo, sucesso) {
    estado.aviso = 'Salvando…'; avisar();
    try {
      const r = await pedir('POST', {}, corpo);
      // Projeto com cliente: as etapas abertas viram demandas na esteira (servidor, PR #542); o aviso diz quantas.
      const n = Array.isArray(r?.demandas) ? r.demandas.length : 0;
      estado.aviso = n ? `${sucesso} ${n === 1 ? '1 etapa foi' : n + ' etapas foram'} para a esteira como demanda.` : sucesso;
      estado.form = ''; estado.editar = null;
      await carregar();
    } catch (e) { estado.aviso = e.message; avisar(); }
  }

  // Etapa que virou demanda na esteira (projeto com cliente): o status na cor do quadro e o clique abre a peça.
  const demandaDaEtapa = (e) => (e?.demanda_id
    ? `<button type="button" class="vp-etapa-demanda" data-vp-demanda="${esc(e.demanda_id)}" title="Abrir a demanda desta etapa">${typeof statusCor === 'function' ? statusCor({ status: e.demanda_status || 'Na esteira' }) : esc(e.demanda_status || 'Na esteira')}</button>`
    : '');

  // ---------- pedaços comuns ----------
  const vazio = (titulo, texto, botao = '') => `<div class="vp-vazio"><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${botao}</div>`;
  const acao = (texto, attrs) => `<button type="button" class="vp-acao" ${attrs}>${esc(texto)}</button>`;
  const sec = (texto, attrs) => `<button type="button" class="vp-sec" ${attrs}>${esc(texto)}</button>`;
  const semMigracao = (d) => (d?.provisionado === false ? '<p class="vp-nota">Esta parte ainda não foi ligada no banco: o que você vê é o começo. Peça ao Paulo para aplicar a migração do setor de Pessoas.</p>' : '');
  function versus(v, { menorMelhor = false, unidade = '' } = {}) {
    if (!v || v.delta == null) return '<small class="vp-vs">sem base no período anterior</small>';
    if (v.delta === 0) return '<small class="vp-vs">igual ao período anterior</small>';
    const bom = menorMelhor ? v.delta < 0 : v.delta > 0;
    return `<small class="vp-vs ${bom ? 'bom' : 'ruim'}">${v.delta > 0 ? '▲' : '▼'} ${esc(Math.abs(v.delta))}${unidade} vs ${estado.periodo === 'anual' ? 'ano' : 'mês'} anterior</small>`;
  }
  const kpi = (rotulo, valor, extra = '') => `<div class="vp-kpi"><span>${esc(rotulo)}</span><b>${esc(valor ?? '—')}</b>${extra}</div>`;
  function seletorPeriodo() {
    const ref = estado.ref || hoje().slice(0, 7);
    return `<div class="vp-periodo"><div class="vp-seg" role="group" aria-label="Período">
        <button type="button" data-vp-periodo="mensal" aria-pressed="${estado.periodo !== 'anual'}">Mensal</button>
        <button type="button" data-vp-periodo="anual" aria-pressed="${estado.periodo === 'anual'}">Anual</button></div>
      <label class="vp-campo-inline"><span class="vp-sr">Mês de referência</span><input type="month" data-vp-ref value="${esc(ref)}" max="${esc(hoje().slice(0, 7))}"></label></div>`;
  }

  // ---------- Produtividade ----------
  function barraComponente(c, valor) {
    const pct = valor == null ? null : Math.round(valor * 100);
    return `<li><span>${esc(c.nome)}</span><span class="vp-barra" aria-hidden="true"><i style="width:${pct ?? 0}%"></i></span><b>${pct == null ? 'sem dado' : pct + '%'}</b></li>`;
  }
  function cartaoPessoa(d, comps, propria) {
    if (!d) return vazio('Ainda sem dado neste mês', 'Quando as demandas do painel com você andarem, o seu mês aparece aqui.');
    const nota = d.score == null ? '—' : d.score;
    return `<div class="vp-cartao vp-score">
      <div class="vp-score-topo"><div class="vp-anel" style="--p:${d.score ?? 0}"><b>${esc(nota)}</b><small>de 100</small></div>
        <div><span class="vp-kicker">${propria ? 'Seu mês' : esc(d.cargoNome || '')}</span><h3>${propria ? 'Como foi o seu mês' : esc(d.nome)}</h3>
        <p>${esc((d.frases || []).join(' · '))}</p>${d.posicao ? `<p class="vp-pos">${esc(d.posicao)}º no ranking</p>` : ''}</div></div>
      <ul class="vp-comps">${comps.map((c) => barraComponente(c, d.componentes?.[c.id])).join('')}</ul>
      ${d.conquistas?.length ? `<div class="vp-conquistas">${d.conquistas.map((c) => `<span class="vp-conquista" title="${esc(c.texto)}">${esc(c.titulo)}</span>`).join('')}</div>` : '<p class="vp-nota">As conquistas do mês aparecem aqui quando chegarem.</p>'}
    </div>`;
  }
  function htmlProdutividade(d) {
    const mes = estado.mes || d.mes || hoje().slice(0, 7);
    const propria = !estado.pessoa || estado.pessoa === d.eu?.id;
    let html = `<div class="vp-linha-topo"><label class="vp-campo-inline"><span>Mês</span><input type="month" data-vp-mes value="${esc(mes)}" max="${esc(hoje().slice(0, 7))}"></label>
      ${!propria ? sec('Voltar para o meu', 'data-vp-pessoa=""') : ''}</div>`;
    html += cartaoPessoa(d.detalhe, d.componentes || [], propria);
    html += `<p class="vp-nota">${d.fonte?.ajustes ? esc(d.fonte.ajustes) + '. ' : ''}Nada para preencher: tudo vem das demandas do painel.</p>`;
    if (!d.gestao) return html;
    const r = d.ranking || [];
    html += `<section class="vp-cartao vp-proj-bloco">${htmlCarga(d.cargaSemana)}</section>`;
    html += `<h3 class="vp-titulo">Ranking do mês <small>só os donos veem</small></h3>`;
    html += r.length ? `<ol class="vp-ranking">${r.map((p) => `<li><button type="button" class="vp-linha" data-vp-pessoa="${esc(p.id)}">
        <span class="vp-pos-n">${p.posicao ?? '–'}</span><span class="vp-meio"><b>${esc(p.nome)}</b><small>${esc(p.cargoNome)} · ${esc(p.entregues)}/${esc(p.meta || 0)} entregas${p.conquistas?.length ? ' · ' + esc(p.conquistas.map((c) => c.titulo).join(', ')) : ''}</small></span>
        <span class="vp-nota-n">${p.score ?? '—'}</span></button></li>`).join('')}</ol>` : vazio('Ninguém na equipe ainda', 'Quem pode entrar no painel aparece aqui.');
    const pesos = d.pesos || {};
    html += `<details class="vp-cartao vp-det"${estado.form === 'pesos' ? ' open' : ''}><summary>Pesos do score</summary>
      <form data-vp-form="pesos" class="vp-form vp-grade">${(d.componentes || []).map((c) => `<label><span>${esc(c.nome)}</span><input type="number" name="${esc(c.id)}" min="0" max="100" step="1" value="${esc(pesos[c.id])}" inputmode="numeric" required></label>`).join('')}
      <p class="vp-nota">O score é a média ponderada: o peso conta em relação aos outros (não precisa somar 100).</p><div class="vp-botoes"><button type="submit" class="vp-acao">Salvar pesos</button></div></form></details>`;
    html += `<details class="vp-cartao vp-det"><summary>Metas de entregas por cargo (no mês)</summary>
      <form data-vp-form="metas" class="vp-form vp-grade">${Object.entries(d.cargos || {}).map(([k, nome]) => `<label><span>${esc(nome)}</span><input type="number" name="${esc(k)}" min="0" max="1000" step="1" value="${esc(d.metas?.[k] ?? 0)}" inputmode="numeric" required></label>`).join('')}
      <p class="vp-nota">No mês corrente a meta vale proporcional aos dias que já passaram.</p><div class="vp-botoes"><button type="submit" class="vp-acao">Salvar metas</button></div></form></details>`;
    return html;
  }

  // ---------- RH ----------
  function proximosAniversarios(lista) {
    const h = hoje(), md = h.slice(5);
    return [...(lista || [])].map((a) => ({ ...a, ordem: a.dia >= md ? a.dia : '13-' + a.dia })).sort((a, b) => a.ordem.localeCompare(b.ordem)).slice(0, 8);
  }
  const nomeTipo = (d, id) => (d.tipos || []).find((t) => t.id === id)?.nome || id;
  const ha = (n) => (n == null ? '' : n === 0 ? 'aberto hoje' : n === 1 ? 'aberto ontem' : `aberto há ${n} dias`);
  const decimal = (v) => String(v).replace('.', ',');
  // Filtros dos números da fila (o mini painel e a lista usam os mesmos).
  const FILTROS_PEDIDO = {
    abertos: ['Pedidos abertos', (p) => p.sla !== 'encerrado', '', 'Nenhum pedido aberto.'],
    fora: ['Fora do prazo', (p) => p.sla === 'atrasado', 'u1', 'Nada fora do prazo.'],
    respondidos: ['Respondidos', (p) => ['resolvido', 'recusado'].includes(p.status) && p.respondido_dia, '', 'Nenhum pedido respondido ainda.'],
  };
  function kpiEspiar(rotulo, valor, chave, { cls = '', extra = '' } = {}) {
    return `<div class="vp-kpi espiavel${cls ? ' ' + cls : ''}" data-espiar="pessoas:${esc(chave)}" role="button" tabindex="0" title="Ver a lista"><span>${esc(rotulo)}</span><b>${esc(valor ?? '—')}</b>${extra}</div>`;
  }
  function kpisPedidos(d) {
    const i = d.indicadores || {};
    const tempo = i.tempoMedioDias == null ? '—' : `${decimal(i.tempoMedioDias)} ${i.tempoMedioDias === 1 ? 'dia útil' : 'dias úteis'}`;
    return `<div class="vp-kpis vp-kpis-3">${kpiEspiar('Abertos', i.abertos ?? 0, 'abertos')}
      ${kpiEspiar('Fora do prazo', i.foraDoPrazo ?? 0, 'fora', { cls: i.foraDoPrazo ? 'u1' : '' })}
      ${kpiEspiar('Tempo médio de resposta', tempo, 'respondidos', { extra: i.noPrazoPct == null ? '<small class="vp-vs">nenhum respondido ainda</small>' : `<small class="vp-vs">${esc(i.noPrazoPct)}% respondidos no prazo</small>` })}</div>`;
  }
  function linhaPedido(p, d) {
    const encerrado = p.sla === 'encerrado', [, cls] = SLA[p.sla] || SLA.sem_prazo;
    const status = (d.status || {})[p.status] || p.status, proprio = p.pessoa_id === d.eu?.id;
    const datas = p.inicio ? (p.inicio === p.fim ? br(p.inicio) : `${br(p.inicio)} a ${br(p.fim)}`) : p.data_desejada ? `para ${br(p.data_desejada)}` : '';
    const linha = [d.gestao ? p.pessoa_nome : '', nomeTipo(d, p.tipo), datas, ha(p.idadeDias), `prazo ${br(p.prazo)}`].filter(Boolean).join(' · ');
    const sla = p.sla === 'atrasado' && p.atrasoUteis ? ['Fora do prazo há ' + plural(p.atrasoUteis, 'dia útil', 'dias úteis'), 'u1'] : SLA[p.sla] || SLA.sem_prazo;
    const final = p.tipo === 'ferias' && p.status === 'resolvido' ? 'Aprovado' : status;
    let botoes = '';
    if (d.gestao && !encerrado) {
      botoes = `<details class="vp-det vp-responder"><summary>Responder</summary><form data-vp-form="responder" data-id="${esc(p.id)}" class="vp-form">
        <label><span>Resposta para ${esc(String(p.pessoa_nome || '').split(' ')[0] || 'quem pediu')}</span><textarea name="resposta" maxlength="2000" rows="2" placeholder="Obrigatória para recusar"></textarea></label>
        <div class="vp-botoes">${p.status === 'aberto' ? '<button type="submit" class="vp-sec" name="status" value="andamento">Em andamento</button>' : ''}
        <button type="submit" class="vp-sec" name="status" value="recusado">Recusar</button><button type="submit" class="vp-acao" name="status" value="resolvido">${p.tipo === 'ferias' ? 'Aprovar' : 'Resolver'}</button></div></form></details>`;
    } else if (proprio && p.status === 'aberto') botoes = `<div class="vp-botoes">${sec('Cancelar pedido', `data-vp-pedido="${esc(p.id)}" data-status="cancelado"`)}</div>`;
    return `<li class="vp-item ${cls}"><div class="vp-meio"><b>${esc(p.titulo)}</b>
      <small>${esc(linha)}</small>
      ${p.descricao ? `<small class="vp-desc">${esc(p.descricao)}</small>` : ''}
      ${p.resposta ? `<small class="vp-resposta"><b>Resposta do RH:</b> ${esc(p.resposta)}</small>` : ''}</div>
      <div class="vp-lado">${encerrado ? chip([final, p.status === 'recusado' ? 'u2' : 'u5']) : chip(sla)}${encerrado ? '' : `<small>${esc(status)}</small>`}</div>
      ${botoes}</li>`;
  }
  function formPedido(d) {
    // Sem a lista do servidor (versão antiga ou resposta parcial), usa os tipos padrão: o formulário nunca abre sem tipo.
    const padrao = [['ferias', 'Férias ou folga', 5], ['documento', 'Documento ou declaração', 2], ['reembolso', 'Reembolso', 3], ['equipamento', 'Equipamento', 3], ['outro', 'Outro assunto', 3]].map(([id, nome, dias]) => ({ id, nome, dias }));
    const tipos = ((d.tipos || []).length ? d.tipos : padrao).filter((t) => t.formulario !== false), atual = estado.tipoPedido && tipos.some((t) => t.id === estado.tipoPedido) ? estado.tipoPedido : tipos[0]?.id;
    const ferias = atual === 'ferias';
    return `<form data-vp-form="pedido" class="vp-cartao vp-form">
      <h3 class="vp-titulo">Nova solicitação ao RH</h3>
      <label><span>Tipo</span><select name="tipo" data-vp-tipo-pedido>${tipos.map((t) => `<option value="${esc(t.id)}"${t.id === atual ? ' selected' : ''}>${esc(t.nome)} (resposta em ${esc(plural(t.dias, 'dia útil', 'dias úteis'))})</option>`).join('')}</select></label>
      <label><span>Assunto</span><input name="titulo" maxlength="200" required placeholder="Ex.: declaração de vínculo"></label>
      <label><span>Descrição</span><textarea name="descricao" maxlength="2000" rows="3" placeholder="Conte o que precisa"></textarea></label>
      <div class="vp-grade vp-ferias"${ferias ? '' : ' hidden'}><label><span>Primeiro dia</span><input type="date" name="inicio"${ferias ? ' required' : ''}></label><label><span>Último dia</span><input type="date" name="fim"${ferias ? ' required' : ''}></label>
        <p class="vp-nota">Folga de um dia: repita a mesma data.</p></div>
      <div class="vp-grade vp-desejada"${ferias ? ' hidden' : ''}><label><span>Data desejada (opcional)</span><input type="date" name="data_desejada" min="${esc(hoje())}"></label></div>
      ${d.rhPronto === false ? `<p class="vp-nota">Reembolso e prazos ajustados pelos donos estão aguardando a migração ${esc(d.migracaoRh || '')}.</p>` : ''}
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Enviar ao RH</button></div></form>`;
  }
  function formPrazos(d) {
    const tipos = (d.tipos || []).filter((t) => t.formulario !== false);
    return `<details class="vp-cartao vp-det"${estado.form === 'prazos' ? ' open' : ''}><summary>Prazos de resposta por tipo</summary>
      <form data-vp-form="prazos" class="vp-form vp-grade">${tipos.map((t) => `<label><span>${esc(t.nome)} (dias úteis)</span><input type="number" name="${esc(t.id)}" min="1" max="30" step="1" value="${esc(t.dias)}" inputmode="numeric" required></label>`).join('')}
      <p class="vp-nota">Conta só dias úteis (segunda a sexta). Vale para os pedidos novos; quem já pediu mantém o prazo que recebeu.</p>
      <div class="vp-botoes"><button type="submit" class="vp-acao"${d.rhPronto === false ? ' disabled' : ''}>Salvar prazos</button></div></form></details>`;
  }
  function htmlPedidos(d) {
    const todos = d.pedidos || [], f = FILTROS_PEDIDO[estado.filtroPedidos];
    let html = `<div class="vp-linha-topo"><h3 class="vp-titulo">${d.gestao ? 'Pedidos ao RH' : 'Seus pedidos ao RH'}</h3>${estado.form === 'pedido' ? '' : acao('Nova solicitação', 'data-vp-abrir-form="pedido"')}</div>`;
    if (estado.form === 'pedido') html += formPedido(d);
    if (todos.length || d.gestao) html += kpisPedidos(d);
    if (f) {
      const lista = todos.filter(f[1]);
      html += `<p class="vp-nota">Mostrando: <b>${esc(f[0])}</b> (${lista.length}) · <button type="button" class="vp-link" data-vp-filtro-pedidos="">Mostrar todos</button></p>`;
      return html + (lista.length ? `<ul class="vp-lista">${lista.map((p) => linhaPedido(p, d)).join('')}</ul>` : vazio(f[3], ''));
    }
    const abertos = todos.filter((p) => p.sla !== 'encerrado');
    html += todos.length ? `<ul class="vp-lista">${[...abertos, ...todos.filter((p) => p.sla === 'encerrado').slice(0, 10)].map((p) => linhaPedido(p, d)).join('')}</ul>`
      : estado.form === 'pedido' ? '' : vazio('Nenhum pedido por aqui', 'Precisa de uma declaração, de férias, de um reembolso ou de algo do RH? Abra uma solicitação e acompanhe o prazo.');
    return html + (d.gestao ? formPrazos(d) : '');
  }

  // Pesquisa de clima com período (08/11/2026): os donos abrem; cada um responde uma vez, sem nome.
  const escala = (nome, de, ate) => `<div class="vp-escala" role="radiogroup">${Array.from({ length: ate - de + 1 }, (_, i) => de + i).map((n) => `<label><input type="radio" name="${nome}" value="${n}" required><span>${n}</span></label>`).join('')}</div>`;
  function formResponderPesquisa(c) {
    return `<form data-vp-form="pesquisa" data-id="${esc(c.atual.id)}" class="vp-cartao vp-form">
      <fieldset><legend>De 0 a 10, você recomendaria a Vybe como lugar para trabalhar? <small>0 = de jeito nenhum · 10 = com certeza</small></legend>${escala('enps', 0, 10)}</fieldset>
      ${(c.dimensoes || []).map((x) => `<fieldset><legend>${esc(x.nome)} <small>1 = muito ruim · 5 = ótimo</small></legend>${escala(x.id, 1, 5)}</fieldset>`).join('')}
      <label><span>Quer dizer mais alguma coisa? (opcional)</span><textarea name="comentario" maxlength="1000" rows="3"></textarea></label>
      <p class="vp-nota">Ninguém vê a sua resposta, nem os donos: ela entra sem nome e sem hora, e o resultado só aparece somado, com ${esc(c.minimo || 3)} respostas ou mais. Evite escrever algo que identifique você no comentário.</p>
      <div class="vp-botoes">${sec('Agora não', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Enviar anônimo</button></div></form>`;
  }
  function formAbrirPesquisa() {
    return `<form data-vp-form="pesquisa-abrir" class="vp-cartao vp-form"><h3 class="vp-titulo">Iniciar pesquisa de clima</h3><div class="vp-grade">
      <label><span>Nome</span><input name="titulo" maxlength="120" required value="Clima ${esc(hoje().slice(5, 7))}/${esc(hoje().slice(0, 4))}"></label>
      <label><span>Abre em</span><input type="date" name="abre" required value="${esc(hoje())}" min="${esc(hoje())}"></label>
      <label><span>Fecha em</span><input type="date" name="fecha" required value="${esc(somarDias(hoje(), 7))}" min="${esc(hoje())}"></label></div>
      <p class="vp-nota">Todos da equipe respondem uma vez: recomendação (eNPS) e cinco notas de 1 a 5. Uma pesquisa por vez; fica aberta no máximo 60 dias.</p>
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Abrir pesquisa</button></div></form>`;
  }
  function deltaDim(v) {
    if (v == null) return '';
    if (v === 0) return '<small class="vp-vs">=</small>';
    return `<small class="vp-vs ${v > 0 ? 'bom' : 'ruim'}">${v > 0 ? '▲' : '▼'} ${esc(decimal(Math.abs(v)))}</small>`;
  }
  function vsEnps(vs) {
    if (!vs || vs.delta == null) return '<small class="vp-vs">sem pesquisa anterior para comparar</small>';
    if (vs.delta === 0) return '<small class="vp-vs">igual à pesquisa anterior</small>';
    return `<small class="vp-vs ${vs.delta > 0 ? 'bom' : 'ruim'}">${vs.delta > 0 ? '▲' : '▼'} ${esc(Math.abs(vs.delta))} pontos vs anterior</small>`;
  }
  const SITUACAO_PESQUISA = { aberta: ['Aberta', 'u6'], agendada: ['Agendada', 'u4'], encerrada: ['Encerrada', 'u5'] };
  function resultadoPesquisa(p, c) {
    const r = p.resultado || {}, de = `${br(p.abre)} a ${br(p.fecha)}`;
    let html = `<div class="vp-cartao"><div class="vp-linha-topo"><div><span class="vp-kicker">Resultado · ${esc(de)}</span><h3>${esc(p.titulo)}</h3></div>${chip(SITUACAO_PESQUISA[p.situacao] || SITUACAO_PESQUISA.encerrada)}</div>`;
    if (!r.liberado) return html + `<p class="vp-nota">${esc(plural(r.respostas || 0, 'resposta', 'respostas'))}${c.equipe ? ` de ${esc(c.equipe)} pessoas` : ''}. O resultado aparece com ${esc(r.minimo || c.minimo || 3)} ou mais, para ninguém ser identificado.</p></div>`;
    html += `<div class="vp-kpis">${kpi('eNPS', r.enps, vsEnps(p.vs))}${kpi('Respostas', c.equipe ? `${r.respostas} de ${c.equipe}` : r.respostas)}${kpi('Promotores (9–10)', r.promotores)}${kpi('Detratores (0–6)', r.detratores)}</div>
      <ul class="vp-comps">${(r.dimensoes || []).map((x) => `<li><span>${esc(x.nome)}</span><span class="vp-barra" aria-hidden="true"><i style="width:${(x.media || 0) / 5 * 100}%"></i></span><b>${x.media == null ? '—' : esc(decimal(x.media))}</b>${deltaDim(p.vsDimensoes?.[x.id])}</li>`).join('')}</ul>
      <p class="vp-nota">eNPS = % de promotores − % de detratores (de −100 a 100). Médias de 1 a 5.</p>
      ${r.comentarios?.length ? `<ul class="vp-comentarios">${r.comentarios.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
    return html + '</div>';
  }
  function htmlClima(d) {
    const c = d.pesquisa || {}, atual = c.atual;
    let html = `<div class="vp-linha-topo"><h3 class="vp-titulo">Pesquisa de clima <small>anônima</small></h3>
      ${d.gestao && atual ? sec('Encerrar agora', `data-vp-encerrar-pesquisa="${esc(atual.id)}"`) : ''}${d.gestao && !atual && d.rhPronto !== false && estado.form !== 'pesquisa-abrir' ? acao('Iniciar pesquisa', 'data-vp-abrir-form="pesquisa-abrir"') : ''}</div>`;
    if (d.rhPronto === false) html += `<p class="vp-nota">A pesquisa de clima com período está aguardando a migração ${esc(d.migracaoRh || '')}. Peça ao Paulo para aplicar.</p>`;
    if (estado.form === 'pesquisa-abrir') html += formAbrirPesquisa();
    if (atual?.situacao === 'aberta') {
      if (atual.respondeu) html += vazio('Obrigado por responder', `A sua resposta entrou sem nome nem hora. "${atual.titulo}" fica aberta até ${br(atual.fecha)}.`);
      else if (estado.form === 'pesquisa') html += formResponderPesquisa(c);
      else html += vazio(atual.titulo, `Aberta até ${br(atual.fecha)}. Seis perguntas rápidas, sem nome: ninguém vê a sua resposta, nem os donos.`, acao('Responder a pesquisa', 'data-vp-abrir-form="pesquisa"'));
    } else if (atual?.situacao === 'agendada') html += vazio('Pesquisa agendada', `"${atual.titulo}" abre em ${br(atual.abre)} e fica até ${br(atual.fecha)}.`);
    else if (d.rhPronto !== false && estado.form !== 'pesquisa-abrir') html += vazio('Nenhuma pesquisa aberta agora', d.gestao ? 'Abra uma pesquisa com período: cada pessoa responde uma vez, sem nome.' : 'Quando os donos abrirem uma pesquisa, ela aparece aqui.');
    if (!d.gestao) return html;
    const hist = c.historico || [];
    if (hist.length) {
      const escolhida = hist.find((p) => p.id === estado.pesquisaVer) || hist[0];
      html += resultadoPesquisa(escolhida, c);
      if (hist.length > 1) html += `<span class="vp-kicker">Pesquisas anteriores</span><ul class="vp-lista">${hist.map((p) => `<li><button type="button" class="vp-linha${p.id === escolhida.id ? ' ativo' : ''}" data-vp-ver-pesquisa="${esc(p.id)}" aria-pressed="${p.id === escolhida.id}"><span class="vp-meio"><b>${esc(p.titulo)}</b><small>${br(p.abre)} a ${br(p.fecha)} · ${esc(plural(p.resultado?.respostas || 0, 'resposta', 'respostas'))}</small>
        ${p.resultado?.liberado ? vsEnps(p.vs) : '<small class="vp-vs">abaixo do mínimo de respostas</small>'}</span><span class="vp-nota-n" title="eNPS">${p.resultado?.liberado ? esc(p.resultado.enps) : '—'}</span></button></li>`).join('')}</ul>`;
    }
    // A pesquisa trimestral antiga (07/11), se alguém chegou a responder.
    const antiga = d.climaResultado;
    if (antiga && antiga.respostas > 0) html += `<p class="vp-nota">Pesquisa trimestral antiga (${esc(antiga.trimestre)}): ${esc(plural(antiga.respostas, 'resposta', 'respostas'))}${antiga.liberado ? `, eNPS ${esc(antiga.enps)}` : ', abaixo do mínimo'}.</p>`;
    return html;
  }
  const mesFolha = () => estado.ref || hoje().slice(0, 7);
  const MESES_RH = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const din = (v) => (v == null ? '—' : BRL.format(Number(v) || 0));
  const pct = (v) => (v == null ? '' : `${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${String(Math.abs(v)).replace('.', ',')}%`);
  function htmlFolha() {
    const e = window.VybeFinancas?.estado?.('rh', mesFolha());
    if (!e || e.status === 403) return '';
    const titulo = '<h3 class="vp-titulo">Folha <small>só os donos veem · fonte: Vybe Finanças</small></h3>';
    if (e.carregando && !e.dados) return titulo + '<p class="vp-nota">Lendo o Vybe Finanças…</p>';
    if (e.erro) return titulo + `<p class="vp-nota">Vybe Finanças: ${esc(e.erro)}</p>`;
    const d = e.dados; if (!d) return '';
    if (!d.conectado) return d.passos ? titulo + `<div class="vp-cartao"><span class="vp-kicker">${esc(d.motivo)}</span><p class="vp-nota">Ligado, aparecem aqui os funcionários do Finanças com cargo, salário, bônus, dia de pagamento, o total do mês e a variação.</p>
      <ol class="vp-simples">${d.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div>` : '';
    const f = d.folha; if (!f) return '';
    const vs = (v, p) => (v ? `<small class="vp-vs ${v > 0 ? 'ruim' : 'bom'}">${esc(pct(p))} (${esc(din(v))}) vs mês anterior</small>` : '<small class="vp-vs">igual ao mês anterior</small>');
    return titulo + `<div class="vp-kpis">
        <div class="vp-kpi espiavel" data-espiar="financas:rh:folha" role="button" tabindex="0" title="Ver a lista"><span>Total de ${esc(MESES_RH[Number(f.mes.slice(5)) - 1])}</span><b>${esc(din(f.total))}</b>${vs(f.variacao, f.variacao_percentual)}</div>
        ${kpi('Funcionários', f.quantidade)}${kpi('Mês anterior', din(f.total_anterior))}</div>
      ${f.funcionarios.length ? `<ul class="vp-lista">${f.funcionarios.map((p) => `<li class="vp-item"><div class="vp-meio"><b>${esc(p.nome)}</b>
        <small>${esc([p.cargo, 'salário ' + din(p.salario), p.bonus ? 'bônus ' + din(p.bonus) : '', p.dia_pagamento ? 'paga dia ' + p.dia_pagamento : 'sem dia de pagamento', p.vigente_desde ? 'valor desde ' + p.vigente_desde.slice(5) + '/' + p.vigente_desde.slice(0, 4) : ''].filter(Boolean).join(' · '))}</small></div>
        <div class="vp-lado"><b>${esc(din(p.total))}</b>${p.variacao ? chip([pct(p.variacao_percentual) || (p.variacao > 0 ? 'subiu' : 'caiu'), p.variacao > 0 ? 'u2' : 'u4']) : ''}</div></li>`).join('')}</ul>`
        : vazio('Nenhum funcionário no Finanças', 'Cadastre a equipe em Funcionários no Vybe Finanças.')}
      <p class="vp-nota">Salário + bônus vigentes no mês pelo histórico de remuneração do Finanças (sem histórico, o valor atual). Variação contra o mês anterior. Para mudar, edite no Finanças.</p>`;
  }
  // ---------- Calendário do time (quadro 61 do moodboard) ----------
  // Aniversários (só dia e mês) e férias e folgas aprovadas num mês de verdade, com as listas dos próximos ao lado para
  // nada sair da tela. As férias vêm do servidor a partir de 31 dias atrás (rota rh): meses mais antigos ficam vazios.
  const SEMANA_RH = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const ICONE_ANIV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M5 20v-7h14v7M12 13V9M9 9.5c0-1 1.3-2 3-4.5 1.7 2.5 3 3.5 3 4.5"/></svg>';
  const ICONE_FERIAS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>';
  const primeiroNome = (n) => String(n || '').trim().split(/\s+/)[0] || '';
  const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  // Mês "AAAA-MM" andando n meses, sem fuso.
  function andarMes(ym, n) { const [a, m] = ym.split('-').map(Number), t = a * 12 + (m - 1) + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }
  // O que cai em cada dia do mês: { 'AAAA-MM-DD': [{ tipo: 'aniv' | 'ferias', nome }] }. Puro, para o teste.
  function eventosDoMes(ym, aniversarios = [], ferias = []) {
    const [ano, mes] = ym.split('-').map(Number), n = diasNoMes(ano, mes), por = {};
    const pos = (iso, ev) => { (por[iso] ||= []).push(ev); };
    for (const a of aniversarios || []) {
      const [m, d] = String(a.dia || '').split('-').map(Number);
      if (m !== mes || !d) continue;
      // 29/02 num ano sem ele aparece no dia 28, para ninguém passar o ano sem parabéns.
      pos(`${ym}-${String(Math.min(d, n)).padStart(2, '0')}`, { tipo: 'aniv', nome: a.nome });
    }
    const ini = `${ym}-01`, fim = `${ym}-${String(n).padStart(2, '0')}`;
    for (const f of ferias || []) {
      if (!f?.inicio) continue;
      const de = f.inicio > ini ? f.inicio : ini, ultimo = f.fim || f.inicio, ate = ultimo < fim ? ultimo : fim;
      if (de > ate) continue;
      for (let d = Number(de.slice(8, 10)); d <= Number(ate.slice(8, 10)); d++) pos(`${ym}-${String(d).padStart(2, '0')}`, { tipo: 'ferias', nome: f.nome });
    }
    return por;
  }
  function htmlCalendario(d) {
    const h = hoje(), ym = /^\d{4}-\d{2}$/.test(estado.calMes) ? estado.calMes : h.slice(0, 7), [ano, mes] = ym.split('-').map(Number);
    const por = eventosDoMes(ym, d.aniversarios, d.ferias), n = diasNoMes(ano, mes), vazios = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
    const nomeMes = MESES_RH[mes - 1], celulas = [];
    for (let i = 0; i < vazios; i++) celulas.push('<span class="vp-cal-dia fora" role="gridcell" aria-hidden="true"></span>');
    for (let dia = 1; dia <= n; dia++) {
      const iso = `${ym}-${String(dia).padStart(2, '0')}`, evs = por[iso] || [];
      const fala = evs.map((e) => (e.tipo === 'aniv' ? `aniversário de ${e.nome}` : `${e.nome} de férias ou folga`)).join('; ');
      celulas.push(`<span class="vp-cal-dia${iso === h ? ' hoje' : ''}${evs.length ? ' com' : ''}" role="gridcell" aria-label="${esc(`${dia} de ${nomeMes}${iso === h ? ', hoje' : ''}${fala ? ': ' + fala : ''}`)}"><b aria-hidden="true">${dia}</b>`
        + evs.slice(0, 3).map((e) => `<small class="vp-cal-ev ${e.tipo}" aria-hidden="true" title="${esc(e.tipo === 'aniv' ? 'Aniversário de ' + e.nome : e.nome + ' de férias ou folga')}">${e.tipo === 'aniv' ? ICONE_ANIV : ICONE_FERIAS}<span>${esc(primeiroNome(e.nome))}</span></small>`).join('')
        + (evs.length > 3 ? `<small class="vp-cal-mais" aria-hidden="true" title="${esc(evs.slice(3).map((e) => e.nome).join(', '))}">+${evs.length - 3}</small>` : '') + '</span>');
    }
    while (celulas.length % 7) celulas.push('<span class="vp-cal-dia fora" role="gridcell" aria-hidden="true"></span>');
    const semanas = []; for (let i = 0; i < celulas.length; i += 7) semanas.push(`<div class="vp-cal-semana" role="row">${celulas.slice(i, i + 7).join('')}</div>`);
    const aniv = proximosAniversarios(d.aniversarios);
    return `<div class="vp-linha-topo"><h3 class="vp-titulo">Calendário do time</h3></div><div class="vp-cal-duas">
      <div class="vp-cartao vp-cal">
        <div class="vp-cal-topo"><button type="button" class="vp-x" data-vp-cal="-1" aria-label="Mês anterior" title="Mês anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button>
          <b class="vp-cal-mes" aria-live="polite">${esc(maiuscula(nomeMes))} de ${ano}</b>
          <button type="button" class="vp-x" data-vp-cal="1" aria-label="Próximo mês" title="Próximo mês"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button>
          ${ym === h.slice(0, 7) ? '' : '<button type="button" class="vp-sec" data-vp-cal="0">Este mês</button>'}</div>
        <div class="vp-cal-grade" role="grid" aria-label="${esc(`Calendário do time, ${nomeMes} de ${ano}`)}"><div class="vp-cal-semana vp-cal-nomes" role="row">${SEMANA_RH.map((s) => `<span role="columnheader">${s}</span>`).join('')}</div>${semanas.join('')}</div>
        <p class="vp-cal-legenda"><span class="vp-cal-ev aniv">${ICONE_ANIV}<span>Aniversário</span></span><span class="vp-cal-ev ferias">${ICONE_FERIAS}<span>Férias ou folga aprovada</span></span></p>
      </div>
      <div class="vp-cal-lado">
        <div class="vp-cartao"><span class="vp-kicker">Próximos aniversários</span>${aniv.length ? `<ul class="vp-simples">${aniv.map((a) => `<li><b>${esc(a.dia.slice(3))}/${esc(a.dia.slice(0, 2))}</b> ${esc(a.nome)}</li>`).join('')}</ul>` : '<p class="vp-nota">Ninguém cadastrou o aniversário ainda.</p>'}
          <form data-vp-form="meu-aniversario" class="vp-form vp-inline">${campoAniversario(d.meuPerfil?.nascimento || '', 'Seu aniversário')}<button type="submit" class="vp-sec">Salvar</button></form>
          <p class="vp-nota">Só o dia e o mês: é o que a equipe vê.</p></div>
        <div class="vp-cartao"><span class="vp-kicker">Férias e folgas aprovadas</span>${(d.ferias || []).length ? `<ul class="vp-simples">${d.ferias.map((f) => `<li><b>${f.inicio === f.fim ? br(f.inicio) : `${br(f.inicio)}–${br(f.fim)}`}</b> ${esc(f.nome)}</li>`).join('')}</ul>` : '<p class="vp-nota">Nenhuma férias ou folga marcada para os próximos dias.</p>'}</div>
      </div></div>`;
  }
  // Aniversário só com dia e mês (os seletores do painel). O ano já guardado, se houver, segue escondido e não muda.
  function campoAniversario(iso, rotulo) {
    const ok = /^\d{4}-\d{2}-\d{2}/.test(iso || ''), ano = ok ? iso.slice(0, 4) : '', mes = ok ? Number(iso.slice(5, 7)) : 0, dia = ok ? Number(iso.slice(8, 10)) : 0;
    return `<fieldset class="vp-aniv"><legend>${esc(rotulo)}</legend><input type="hidden" name="nasc_ano" value="${esc(ano)}">
      <div class="vp-aniv-campos"><select name="nasc_dia" aria-label="${esc(rotulo)}: dia"><option value="">Dia</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}"${i + 1 === dia ? ' selected' : ''}>${i + 1}</option>`).join('')}</select>
      <select name="nasc_mes" aria-label="${esc(rotulo)}: mês"><option value="">Mês</option>${MESES_RH.map((m, i) => `<option value="${i + 1}"${i + 1 === mes ? ' selected' : ''}>${m}</option>`).join('')}</select></div></fieldset>`;
  }
  // { valor: 'AAAA-MM-DD' | null } ou { erro }. Sem ano guardado vai 2000 (bissexto: aceita 29 de fevereiro); o servidor
  // só mostra o dia e o mês.
  function nascimentoDoForm(f) {
    const dia = Number(f.nasc_dia) || 0, mes = Number(f.nasc_mes) || 0;
    if (!dia && !mes) return { valor: null };
    if (!dia || !mes) return { erro: 'Escolha o dia e o mês do aniversário.' };
    if (dia > diasNoMes(2000, mes)) return { erro: `${maiuscula(MESES_RH[mes - 1])} não tem dia ${dia}.` };
    let ano = /^\d{4}$/.test(f.nasc_ano || '') ? Number(f.nasc_ano) : 2000;
    if (dia > diasNoMes(ano, mes)) ano = 2000;
    return { valor: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}` };
  }
  function htmlRh(d) {
    let html = semMigracao(d);
    if (d.gestao && d.visao) {
      const v = d.visao, a = v.atual;
      html += `<h3 class="vp-titulo">Visão geral</h3>${seletorPeriodo()}<div class="vp-kpis">
        ${kpi('Headcount', a.headcount, versus(v.vs.headcount))}${kpi('Admissões', a.admissoes, versus(v.vs.admissoes))}
        ${kpi('Desligamentos', a.desligamentos, versus(v.vs.desligamentos, { menorMelhor: true }))}
        ${kpi('Tempo médio de casa', a.tempoMedioMeses == null ? '—' : String(a.tempoMedioMeses).replace('.', ',') + ' meses', versus(v.vs.tempoMedioMeses, { unidade: ' meses' }))}</div>
        ${v.semEntrada ? `<p class="vp-nota">${plural(v.semEntrada, 'pessoa está', 'pessoas estão')} sem data de entrada: o tempo de casa não conta ${v.semEntrada === 1 ? 'ela' : 'elas'}. Preencha em Datas de RH.</p>` : ''}`;
    }
    html += htmlPedidos(d);
    html += htmlCalendario(d);
    if (d.gestao) {
      const pessoas = d.pessoas || [];
      html += `<details class="vp-cartao vp-det"><summary>Datas de RH (entrada, saída e aniversário)</summary>
        <form data-vp-form="perfil" class="vp-form vp-grade"><label><span>Pessoa</span><select name="pessoa_id" required data-vp-perfil-pessoa>${pessoasOpcoes(pessoas, '', 'Escolha')}</select></label>
        ${campoAniversario('', 'Aniversário')}<label><span>Entrada na Vybe</span><input type="date" name="entrada"></label><label><span>Saída</span><input type="date" name="saida"></label>
        <div class="vp-botoes"><button type="submit" class="vp-acao">Salvar datas</button></div></form></details>`;
    }
    return html + (d.gestao ? htmlFolha() : '') + htmlClima(d);
  }

  // Mini painel dos números da fila e do clima (data-espiar="pessoas:…", desenhado por vybe-mundo.js).
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).pessoas = (resto) => {
    const d = estado.dados.rh; if (!d) return null;
    if (resto === 'clima') {
      const hist = d.pesquisa?.historico || [];
      return { titulo: 'Pesquisas de clima', cls: '', vazio: 'Nenhuma pesquisa ainda.', rodape: 'Clique para ver o resultado',
        itens: hist.map((p) => ({ id: p.id, nome: p.titulo, sub: `${br(p.abre)} a ${br(p.fecha)} · ${plural(p.resultado?.respostas || 0, 'resposta', 'respostas')}`, dir: p.resultado?.liberado ? `eNPS ${p.resultado.enps}` : 'abaixo do mínimo' })),
        clicar: (it) => { estado.pesquisaVer = it.id; pintar(); } };
    }
    const f = FILTROS_PEDIDO[resto]; if (!f) return null;
    const lista = (d.pedidos || []).filter(f[1]);
    return { titulo: f[0], cls: f[2], vazio: f[3], rodape: 'Clique para filtrar a lista',
      itens: lista.map((p) => ({ id: p.id, nome: p.titulo, sub: [d.gestao ? p.pessoa_nome : '', nomeTipo(d, p.tipo), ha(p.idadeDias)].filter(Boolean).join(' · '),
        dir: p.sla === 'atrasado' ? `${plural(p.atrasoUteis || 0, 'dia útil', 'dias úteis')} fora` : p.respondido_dia ? `respondido ${br(p.respondido_dia)}` : `prazo ${br(p.prazo)}`, cls: p.sla === 'atrasado' ? 'u1' : '' })),
      clicar: () => { estado.filtroPedidos = resto; estado.form = ''; pintar(); } };
  };

  // ---------- Projetos ----------
  function htmlCarga(d) {
    if (!d) return `<h3 class="vp-titulo">Carga da semana</h3>${typeof vbEstadoHtml === 'function' ? vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando a carga' }) : ''}`;
    if (d.erro) return `<h3 class="vp-titulo">Carga da semana</h3><p class="vp-nota">Não deu para ler a carga agora. ${sec('Tentar de novo', 'data-vp-carga-semana="0"')}</p>`;
    const semana = d.semana || '';
    return `<div class="vp-linha-topo"><h3 class="vp-titulo">Carga da semana <small>${br(semana)} a ${br(d.fim)} · capacidade ${esc(d.capacidade)} itens</small></h3>
      <div class="vp-nav">${sec('‹', 'data-vp-carga-semana="-7" aria-label="Semana anterior"')}${sec('Hoje', 'data-vp-carga-semana="0"')}${sec('›', 'data-vp-carga-semana="7" aria-label="Próxima semana"')}</div></div>
      ${(d.carga || []).length ? `<ul class="vp-lista vp-carga">${d.carga.map((c) => `<li class="vp-item"><div class="vp-meio"><b>${esc(c.nome)}</b>
        <small>${plural(c.pecas, 'demanda', 'demandas')}${c.atrasadas ? ` · ${c.atrasadas} atrasada${c.atrasadas === 1 ? '' : 's'}` : ''}${c.etapas ? ` · ${plural(c.etapas, 'ponto', 'pontos')} de projeto` : ''}</small>
        <span class="vp-barra larga ${NIVEL[c.nivel][1]}" aria-hidden="true"><i style="width:${Math.min(100, c.pct)}%"></i></span></div>
        <div class="vp-lado">${chip(NIVEL[c.nivel])}<small>${esc(c.pct)}%</small></div></li>`).join('')}</ul>` : vazio('Ninguém na equipe ainda', '')}`;
  }
  function htmlGantt(d) {
    let l = d.linha || {};
    if (!(l.projetos || []).length) return vazio('Nenhum projeto pontual', 'Evento, lançamento ou site fora do mensal: crie o projeto com as etapas e veja tudo na linha do tempo.', d.gestao ? acao('Novo projeto', 'data-vp-abrir-form="projeto"') : '');
    const PX = { dia: 46, semana: 16, mes: 6 }[estado.projZoom || 'semana'];
    const largura = Math.max(560, (l.dias || (l.semanas || []).length * 7) * PX);
    const sel = estado.projSel || '';
    l = { ...l, projetos: (l.projetos || []).filter((p) => !sel || p.id === sel) };
    return `<div class="vp-gantt" role="region" aria-label="Linha do tempo dos projetos" tabindex="0"><div class="vp-gantt-in" style="min-width:${largura}px">
      <div class="vp-gantt-semanas">${l.semanas.map((s) => `<span style="left:${s.esq}%">${br(s.inicio)}</span>`).join('')}</div>
      ${l.hoje != null ? `<div class="vp-gantt-agora" aria-hidden="true"><i style="left:${l.hoje}%"></i></div>` : ''}
      ${l.projetos.map((p) => `<div class="vp-gantt-proj"><div class="vp-gantt-nome"><b>${esc(p.nome)}</b><small>${esc(TIPOS_PROJETO[p.tipo] || '')}${p.cliente ? ' · ' + (typeof cliCor === 'function' ? cliCor(p.cliente) : esc(p.cliente)) : ''} · ${esc(STATUS_PROJETO[p.status] || '')}</small>
          ${d.gestao ? `<button type="button" class="vp-link" data-vp-editar-projeto="${esc(p.id)}">Editar</button>` : ''}</div>
        ${p.pos ? `<div class="vp-gantt-trilho"><span class="vp-gantt-barra proj" style="left:${p.pos.esq}%;width:${p.pos.larg}%"></span></div>` : ''}
        ${p.etapas.map((e) => {
          const pode = d.gestao || e.responsavel === d.eu?.id;
          return `<div class="vp-gantt-etapa"><label class="vp-gantt-rotulo"><input type="checkbox" data-vp-etapa="${esc(e.id)}"${e.feita ? ' checked' : ''}${pode ? '' : ' disabled'}><span>${esc(e.nome)}<small>${esc(e.responsavel_nome || 'sem responsável')} · ${br(e.inicio)}–${br(e.fim)}</small>${demandaDaEtapa(e)}</span></label>
            <div class="vp-gantt-trilho">${e.pos ? `<span class="vp-gantt-barra${e.feita ? ' feita' : e.atrasada ? ' atrasada' : ''}" style="left:${e.pos.esq}%;width:${e.pos.larg}%"></span>` : ''}</div></div>`;
        }).join('')}</div>`).join('')}</div></div>`;
  }
  function linhaEtapa(e, pessoas) {
    return `<div class="vp-etapa-form"><input type="hidden" name="e_id" value="${esc(e.id || '')}"><input type="hidden" name="e_feita" value="${e.feita ? '1' : ''}">
      <label><span>Etapa</span><input name="e_nome" maxlength="200" required value="${esc(e.nome || '')}"></label>
      <label><span>Responsável</span><select name="e_responsavel">${pessoasOpcoes(pessoas, e.responsavel)}</select></label>
      <label><span>Início</span><input type="date" name="e_inicio" required value="${esc(e.inicio || '')}"></label>
      <label><span>Fim</span><input type="date" name="e_fim" required value="${esc(e.fim || '')}"></label>
      <label><span>Esforço</span><select name="e_esforco">${opcoes({ 1: 'Leve', 2: 'Médio', 3: 'Pesado' }, e.esforco || 1)}</select></label>
      <button type="button" class="vp-link perigo" data-vp-remover-linha>Remover</button></div>`;
  }
  function formProjeto(d) {
    const p = estado.editar || { etapas: [] };
    return `<form data-vp-form="projeto" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(p.id || '')}">
      <h3 class="vp-titulo">${p.id ? 'Editar projeto' : 'Novo projeto'}</h3>
      <div class="vp-grade"><label><span>Nome</span><input name="nome" maxlength="200" required value="${esc(p.nome || '')}"></label>
      <label><span>Tipo</span><select name="tipo">${opcoes(TIPOS_PROJETO, p.tipo || 'evento')}</select></label>
      ${(d?.clientes || []).length
        // Cliente pela lista oficial (auditoria 09/11, A2: o servidor grava cliente_id e o nome do cadastro). Projeto antigo
        // com o cliente em texto continua com ele até alguém escolher da lista.
        ? `<label><span>Cliente</span><select name="cliente_id"><option value="">${esc(p.cliente && !p.cliente_id ? p.cliente + ' (texto antigo)' : 'Projeto interno (sem cliente)')}</option>${d.clientes.map((c) => `<option value="${esc(c.id)}"${String(c.id) === String(p.cliente_id || '') ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}</select><input type="hidden" name="cliente" value="${esc(p.cliente_id ? '' : p.cliente || '')}"></label>`
        : `<label><span>Cliente</span><input name="cliente" maxlength="200" value="${esc(p.cliente || '')}"></label>`}
      <label><span>Status</span><select name="status">${opcoes(STATUS_PROJETO, p.status || 'planejado')}</select></label>
      <label><span>Início</span><input type="date" name="inicio" required value="${esc(p.inicio || '')}"></label>
      <label><span>Fim</span><input type="date" name="fim" required value="${esc(p.fim || '')}"></label></div>
      <label><span>Descrição</span><textarea name="descricao" maxlength="2000" rows="2">${esc(p.descricao || '')}</textarea></label>
      <span class="vp-kicker">Etapas</span><div class="vp-etapas" data-vp-etapas>${(p.etapas || []).map((e) => linhaEtapa(e, d.pessoas)).join('')}</div>
      ${sec('Adicionar etapa', 'data-vp-nova-etapa')}
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar projeto</button></div></form>`;
  }
  function htmlProjetos(d) {
    const ps = (d.projetos || []).filter((p) => p.status !== 'cancelado'), hj = d.hoje || hoje(), em7 = somarDias(hj, 7);
    const atrasado = (p) => p.status !== 'concluido' && ((p.fim && p.fim < hj) || (p.etapas || []).some((e) => !e.feita && e.fim && e.fim < hj));
    const vencendo = ps.flatMap((p) => (p.etapas || []).filter((e) => !e.feita && e.fim && e.fim >= hj && e.fim <= em7));
    const num = (rot, v, cls = '', sub = '') => `<div class="vp-num ${cls}"><span>${rot}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    let html = semMigracao(d) + `<div class="vp-nums">${num('Em andamento', ps.filter((p) => p.status === 'andamento').length, '', `${ps.filter((p) => p.status === 'planejado').length} planejados`)}${num('Concluídos', ps.filter((p) => p.status === 'concluido').length, 'ok')}${num('Atrasados', ps.filter(atrasado).length, ps.some(atrasado) ? 'ruim' : '')}${num('Etapas vencendo em 7 dias', vencendo.length, vencendo.length ? 'atencao' : '')}</div>`;
    // Gantt: um projeto ou todos, com zoom.
    const zoom = estado.projZoom || 'semana';
    html += `<section class="vp-cartao vp-proj-bloco"><div class="vp-linha-topo"><h3 class="vp-titulo">Gantt de projetos pontuais</h3>
      <div class="vp-proj-ctl"><label class="vp-sr-pai"><span class="vp-sr">Projeto</span><select data-vp-proj-sel><option value="">Todos os projetos</option>${ps.map((p) => `<option value="${esc(p.id)}"${p.id === estado.projSel ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <span class="vp-seg" role="group" aria-label="Zoom">${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, r]) => `<button type="button" data-vp-proj-zoom="${k}" aria-pressed="${zoom === k}">${r}</button>`).join('')}</span>
        ${d.gestao && estado.form !== 'projeto' ? acao('Adicionar projeto', 'data-vp-abrir-form="projeto"') : ''}</div></div>
      ${estado.form === 'projeto' ? formProjeto(d) : ''}${htmlGantt(d)}</section>`;
    // Linha do tempo da semana: as etapas de cada dia (todos ou só as minhas).
    const ini = d.semana || hj, dias = Array.from({ length: 7 }, (_, i) => somarDias(ini, i));
    const eu = d.eu?.id || (d.pessoas || []).find((x) => String(x.nome || '').split(' ')[0].toLowerCase() === String((typeof operadorDoTopo === 'function' ? (operadorDoTopo()?.name || operadorDoTopo()?.nome) : '') || '').split(' ')[0].toLowerCase())?.id;
    const meus = estado.projFiltro === 'meus';
    const etapasDia = (dia) => ps.flatMap((p) => (p.etapas || []).filter((e) => e.inicio && e.fim && e.inicio <= dia && e.fim >= dia && (!meus || String(e.responsavel) === String(eu))).map((e) => ({ e, p })));
    const NOMES = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    html += `<section class="vp-cartao vp-proj-bloco"><div class="vp-linha-topo"><h3 class="vp-titulo">Linha do tempo da semana <small>${br(ini)} a ${br(somarDias(ini, 6))}</small></h3>
      <div class="vp-proj-ctl"><span class="vp-seg" role="group" aria-label="De quem">${[['todos', 'Todos'], ['meus', 'Meus projetos']].map(([k, r]) => `<button type="button" data-vp-proj-filtro="${k}" aria-pressed="${(estado.projFiltro || 'todos') === k}">${r}</button>`).join('')}</span>
        <div class="vp-nav">${sec('‹', 'data-vp-semana="-7" aria-label="Semana anterior"')}${sec('Hoje', 'data-vp-semana="0"')}${sec('›', 'data-vp-semana="7" aria-label="Próxima semana"')}</div></div></div>
      <div class="vp-semana7">${dias.map((dia) => { const l = etapasDia(dia); return `<div class="vp-dia${dia === hj ? ' hoje' : ''}"><small>${NOMES[new Date(dia + 'T12:00:00Z').getUTCDay()]}</small><b>${br(dia).slice(0, 5)}</b>
        ${l.length ? l.map(({ e, p }) => `<span class="vp-etapa-dia${e.feita ? ' feita' : e.fim < hj ? ' atrasada' : ''}" title="${esc(p.nome)} · ${esc(e.responsavel_nome || 'sem responsável')}"><b>${esc(e.nome)}</b><small>${esc(p.nome)}</small></span>`).join('') : '<span class="vp-dia-vazio">—</span>'}</div>`; }).join('')}</div></section>`;
    return html;
  }

  // ---------- Academy ----------
  function linhaAula(a, i) {
    return `<div class="vp-aula-form"><input type="hidden" name="a_id" value="${esc(a.id || '')}">
      <label><span>Aula ${i + 1}</span><input name="a_titulo" maxlength="200" required value="${esc(a.titulo || '')}"></label>
      <label><span>Tipo</span><select name="a_tipo">${opcoes({ video: 'Vídeo', doc: 'Documento' }, a.tipo || 'video')}</select></label>
      <label><span>Link (https://)</span><input type="url" name="a_link" maxlength="1000" placeholder="https://" value="${esc(a.link || '')}"></label>
      <label><span>Minutos</span><input type="number" name="a_minutos" min="1" max="600" value="${esc(a.minutos || 10)}" inputmode="numeric"></label>
      <button type="button" class="vp-link perigo" data-vp-remover-linha>Remover</button></div>`;
  }
  function formTrilha() {
    const t = estado.editar || { aulas: [] };
    return `<form data-vp-form="trilha" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(t.id || '')}">
      <h3 class="vp-titulo">${t.id ? 'Editar trilha' : 'Nova trilha'}</h3>
      <label><span>Nome</span><input name="nome" maxlength="200" required value="${esc(t.nome || '')}"></label>
      <label><span>Descrição</span><textarea name="descricao" maxlength="2000" rows="2">${esc(t.descricao || '')}</textarea></label>
      <div class="vp-etapas" data-vp-aulas>${(t.aulas || []).map(linhaAula).join('')}</div>${sec('Adicionar aula', 'data-vp-nova-aula')}
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar trilha</button></div></form>`;
  }
  function cartaoTrilha(t, d, modelo = false) {
    const feitas = new Set(d.feitas || []), pr = t.progresso || { pct: 0, concluidas: 0, total: (t.aulas || []).length };
    return `<div class="vp-cartao vp-trilha"><div class="vp-linha-topo"><div><span class="vp-kicker">${t.minha ? 'Atribuída a você' : modelo ? 'Modelo' : 'Trilha'}</span><h3>${esc(t.nome)}</h3><p>${esc(t.descricao || '')}</p></div>
        ${d.gestao && !modelo ? `<button type="button" class="vp-link" data-vp-editar-trilha="${esc(t.id)}">Editar</button>` : ''}</div>
      <div class="vp-progresso"><span class="vp-barra larga u6" aria-hidden="true"><i style="width:${pr.pct}%"></i></span><small>${esc(pr.concluidas)} de ${esc(pr.total)} aulas · ${esc(pr.pct)}%</small></div>
      <ol class="vp-aulas">${(t.aulas || []).map((a) => `<li><label><input type="checkbox" data-vp-aula="${esc(a.id || '')}"${feitas.has(String(a.id)) ? ' checked' : ''}${modelo ? ' disabled' : ''}><span>${esc(a.titulo)}<small>${a.tipo === 'doc' ? 'Documento' : 'Vídeo'} · ${esc(a.minutos)} min</small></span></label>
        ${a.link ? `<a class="vp-link" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : '<small class="vp-nota">link a definir</small>'}</li>`).join('')}</ol>
      ${d.gestao && !modelo ? `<details class="vp-det"><summary>Atribuir e acompanhar</summary>
        <form data-vp-form="atribuir" class="vp-form vp-inline"><input type="hidden" name="trilha_id" value="${esc(t.id)}"><label><span>Pessoa</span><select name="pessoa_id" required>${pessoasOpcoes(d.pessoas, '', 'Escolha')}</select></label>
        <label><span>Prazo</span><input type="date" name="prazo"></label><button type="submit" class="vp-acao">Atribuir</button></form>
        ${(t.atribuidas || []).length ? `<ul class="vp-simples">${t.atribuidas.map((a) => `<li><b>${esc(a.progresso.pct)}%</b> ${esc(a.nome)}${a.prazo ? ` · até ${br(a.prazo)}` : ''}</li>`).join('')}</ul>` : '<p class="vp-nota">Ninguém com esta trilha ainda.</p>'}</details>` : ''}</div>`;
  }
  function htmlAcademy(d) {
    let html = semMigracao(d);
    if (d.gestao && d.provisionado !== false) html += `<div class="vp-linha-topo"><h3 class="vp-titulo">Trilhas</h3>${estado.form === 'trilha' ? '' : acao('Nova trilha', 'data-vp-abrir-form="trilha"')}</div>`;
    if (estado.form === 'trilha') html += formTrilha();
    const trilhas = [...(d.trilhas || [])].sort((a, b) => Number(b.minha) - Number(a.minha));
    if (trilhas.length) return html + trilhas.map((t) => cartaoTrilha(t, d)).join('');
    if (d.modelo) return html + cartaoTrilha({ ...d.modelo, aulas: d.modelo.aulas.map((a, i) => ({ ...a, id: 'm' + i })) }, d, true);
    return html + vazio('Nenhuma trilha ainda', 'Monte a primeira trilha com os vídeos e documentos de quem está chegando.', d.gestao ? acao('Nova trilha', 'data-vp-abrir-form="trilha"') : '');
  }

  // ---------- Recrutamento ----------
  function htmlRecrutamento(d) {
    if (d.proibido) return vazio('Recrutamento é dos donos', 'Esta aba é só para os donos e quem administra.');
    const ind = d.indicadores || {}, etapas = d.etapas || [];
    const cands = (d.candidatos || []).filter((c) => !estado.vaga || c.vaga_id === estado.vaga);
    const nomeVaga = Object.fromEntries((d.vagas || []).map((v) => [v.id, v.titulo]));
    let html = semMigracao(d) + seletorPeriodo() + `<div class="vp-kpis">${kpi('Vagas abertas', ind.abertas)}${kpi('Candidatos', ind.candidatos)}
      ${kpi('Tempo médio de contratação', ind.tempoMedio?.dias == null ? '—' : plural(ind.tempoMedio.dias, 'dia', 'dias'), versus(ind.vs, { menorMelhor: true, unidade: ' dias' }))}</div>`;
    html += `<div class="vp-linha-topo"><label class="vp-campo-inline"><span>Vaga</span><select data-vp-vaga><option value="">Todas</option>${(d.vagas || []).map((v) => `<option value="${esc(v.id)}"${v.id === estado.vaga ? ' selected' : ''}>${esc(v.titulo)}${v.status !== 'aberta' ? ' (' + esc(v.status) + ')' : ''}</option>`).join('')}</select></label>
      <div class="vp-botoes">${sec('Etapas', 'data-vp-abrir-form="etapas"')}${sec('Nova vaga', 'data-vp-abrir-form="vaga"')}${(d.vagas || []).length ? acao('Novo candidato', 'data-vp-abrir-form="candidato"') : ''}</div></div>`;
    if (estado.form === 'vaga') {
      const v = estado.editar || {};
      html += `<form data-vp-form="vaga" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(v.id || '')}"><div class="vp-grade">
        <label><span>Título</span><input name="titulo" maxlength="200" required value="${esc(v.titulo || '')}"></label><label><span>Cargo</span><input name="cargo" maxlength="100" value="${esc(v.cargo || '')}"></label>
        <label><span>Status</span><select name="status">${opcoes({ aberta: 'Aberta', pausada: 'Pausada', fechada: 'Fechada' }, v.status || 'aberta')}</select></label></div>
        <label><span>Descrição</span><textarea name="descricao" rows="2" maxlength="2000">${esc(v.descricao || '')}</textarea></label>
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar vaga</button></div></form>`;
    }
    if (estado.form === 'candidato') {
      const c = estado.editar || {};
      html += `<form data-vp-form="candidato" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(c.id || '')}"><div class="vp-grade">
        <label><span>Nome</span><input name="nome" maxlength="200" required value="${esc(c.nome || '')}"></label><label><span>Contato</span><input name="contato" maxlength="200" value="${esc(c.contato || '')}"></label>
        <label><span>Vaga</span><select name="vaga_id" required>${(d.vagas || []).map((v) => `<option value="${esc(v.id)}"${v.id === (c.vaga_id || estado.vaga) ? ' selected' : ''}>${esc(v.titulo)}</option>`).join('')}</select></label>
        <label><span>Etapa</span><select name="etapa">${etapas.map((e) => `<option${e === (c.etapa || etapas[0]) ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></label></div>
        <label><span>Observação</span><textarea name="observacao" rows="2" maxlength="2000">${esc(c.observacao || '')}</textarea></label>
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar candidato</button></div></form>`;
    }
    if (estado.form === 'etapas') html += `<form data-vp-form="etapas" class="vp-cartao vp-form"><label><span>Etapas do funil (uma por linha, na ordem)</span><textarea name="etapas" rows="5">${esc(etapas.join('\n'))}</textarea></label>
      <p class="vp-nota">A etapa chamada Aprovado (ou Contratado) conta como contratação; a última é a de saída.</p><div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar etapas</button></div></form>`;
    if (!(d.vagas || []).length) return html + (estado.form === 'vaga' ? '' : vazio('Nenhuma vaga aberta', 'Abra uma vaga para começar a receber candidatos no funil.', acao('Abrir vaga', 'data-vp-abrir-form="vaga"')));
    if (estado.vaga) html += `<p class="vp-nota"><button type="button" class="vp-link" data-vp-editar-vaga="${esc(estado.vaga)}">Editar esta vaga</button></p>`;
    return html + `<div class="vp-kanban" role="region" aria-label="Funil de candidatos" tabindex="0">${etapas.map((e) => {
      const lista = cands.filter((c) => c.etapa === e);
      return `<section class="vp-coluna"><h4>${esc(e)} <span class="vp-n">${lista.length}</span></h4>${lista.length ? lista.map((c) => `<article class="vp-card">
        <button type="button" class="vp-card-nome" data-vp-editar-candidato="${esc(c.id)}">${esc(c.nome)}</button>
        <small>${esc(nomeVaga[c.vaga_id] || '')} · desde ${br(c.criado_em)}${c.contratado_em ? ' · contratado ' + br(c.contratado_em) : ''}</small>
        <label class="vp-mover"><span class="vp-sr">Mover ${esc(c.nome)} para</span><select data-vp-mover="${esc(c.id)}">${etapas.map((x) => `<option${x === e ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label></article>`).join('') : '<p class="vp-nota">Ninguém aqui.</p>'}</section>`;
    }).join('')}</div>`;
  }

  // ---------- Documentos ----------
  function htmlDocumentos(d) {
    if (d.proibido) return vazio('Documentos são dos donos', 'Esta aba é só para os donos e quem administra.');
    let html = semMigracao(d) + `<div class="vp-linha-topo"><p class="vp-nota">${d.avisos ? `<b class="vp-alerta">${plural(d.avisos, 'documento pede', 'documentos pedem')} atenção</b> (vencido ou renovando em até ${esc(d.avisoDias)} dias).` : 'Nenhuma renovação nos próximos dias.'}</p>
      ${estado.form === 'documento' ? '' : acao('Novo documento', 'data-vp-abrir-form="documento"')}</div>`;
    if (estado.form === 'documento') {
      const x = estado.editar || {};
      html += `<form data-vp-form="documento" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(x.id || '')}"><div class="vp-grade">
        <label><span>Colaborador</span><select name="pessoa_id" required>${pessoasOpcoes(d.pessoas, x.pessoa_id, 'Escolha')}</select></label>
        <label><span>Tipo</span><select name="tipo">${opcoes(d.tipos || {}, x.tipo || 'contrato')}</select></label>
        <label><span>Título</span><input name="titulo" maxlength="200" required value="${esc(x.titulo || '')}"></label>
        <label><span>Status</span><select name="status">${opcoes({ ativo: 'Ativo', encerrado: 'Encerrado' }, x.status || 'ativo')}</select></label>
        <label><span>Início</span><input type="date" name="inicio" value="${esc(x.inicio || '')}"></label><label><span>Renovação</span><input type="date" name="renovacao" value="${esc(x.renovacao || '')}"></label></div>
        <label><span>Link do arquivo (https://)</span><input type="url" name="link" maxlength="1000" value="${esc(x.link || '')}"></label>
        <label><span>Observação</span><textarea name="observacao" rows="2" maxlength="2000">${esc(x.observacao || '')}</textarea></label>
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar documento</button></div></form>`;
    }
    if (!(d.documentos || []).length) return html + (estado.form === 'documento' ? '' : vazio('Nenhum documento cadastrado', 'Registre contratos e documentos da equipe para ser avisado antes de vencer.', acao('Cadastrar o primeiro', 'data-vp-abrir-form="documento"')));
    return html + `<ul class="vp-lista">${d.documentos.map((x) => `<li class="vp-item ${(DOC[x.situacao] || DOC.em_dia)[1]}"><div class="vp-meio"><b>${esc(x.titulo)}</b>
      <small>${esc(x.pessoa_nome)} · ${esc((d.tipos || {})[x.tipo] || x.tipo)} · início ${br(x.inicio)} · renovação ${br(x.renovacao)}</small></div>
      <div class="vp-lado">${chip(DOC[x.situacao] || DOC.em_dia)}<span class="vp-botoes">${x.link ? `<a class="vp-link" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}<button type="button" class="vp-link" data-vp-editar-documento="${esc(x.id)}">Editar</button></span></div></li>`).join('')}</ul>`;
  }

  // ---------- desenho ----------
  const DESENHO = { produtividade: htmlProdutividade, rh: htmlRh, projetos: htmlProjetos, academy: htmlAcademy, recrutamento: htmlRecrutamento, documentos: htmlDocumentos };
  function htmlCorpo() {
    const d = estado.dados[estado.aba];
    if (!d) return estado.erro ? vazio('Não deu para abrir agora', estado.erro, acao('Tentar de novo', 'data-vp-recarregar')) : '<p class="vp-carregando" role="status">Carregando…</p>';
    return (estado.erro ? `<p class="vp-erro">Não foi possível atualizar: ${esc(estado.erro)} <button type="button" class="vp-link" data-vp-recarregar>Tentar de novo</button></p>` : '') + DESENHO[estado.aba](d);
  }
  function htmlPainel() {
    // Aberto pelo dock, a janela mostra só as abas daquele item (opções { abas, rotulo }); com uma aba só, sem barra de abas.
    const g = gestao(), abas = ABAS.filter(([k]) => (g || !SO_GESTAO.has(k)) && (!estado.soAbas || estado.soAbas.has(k)));
    return `<div class="vp-topo"><div><span class="vp-kicker">${esc(estado.rotulo || 'Pessoas')}</span><h2 id="vp-titulo">${esc((ABAS.find(([k]) => k === estado.aba) || ABAS[0])[1])}</h2></div>
        <div class="vp-topo-botoes"><button type="button" class="vp-x" data-vp-ajuda aria-expanded="${estado.ajuda}" aria-label="O que é esta aba" title="O que é esta aba">?</button>
        <button type="button" class="vp-x" data-vp-fechar aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>
      ${estado.ajuda ? `<p class="vp-ajuda" role="note">${esc(AJUDA[estado.aba])}</p>` : ''}
      <div class="vp-abas" role="tablist" aria-label="Partes do setor de Pessoas"${abas.length > 1 ? '' : ' hidden'}>${abas.map(([k, r]) => `<button type="button" role="tab" id="vp-aba-${k}" aria-controls="vp-corpo" aria-selected="${k === estado.aba}" data-vp-aba="${k}">${esc(r)}</button>`).join('')}</div>
      <p class="vp-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vp-corpo" id="vp-corpo" role="tabpanel" aria-labelledby="vp-aba-${estado.aba}" aria-busy="${estado.carregando}">${htmlCorpo()}</div>`;
  }
  function pintar() {
    const janela = estado.janela; if (!janela) return;
    const corpo = janela.querySelector?.('.vp-corpo'), rolagem = corpo?.scrollTop || 0;
    janela.innerHTML = htmlPainel();
    const novo = janela.querySelector?.('.vp-corpo'); if (novo) novo.scrollTop = rolagem;
  }
  function avisar() { const el = estado.raiz?.querySelector?.('.vp-aviso'); if (el) el.textContent = estado.aviso; }

  // ---------- formulários ----------
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const linhas = (form, sel) => [...form.querySelectorAll(sel)].map((el) => Object.fromEntries([...el.querySelectorAll('input,select,textarea')].map((i) => [i.name, i.value])));
  function enviar(form, botao) {
    const f = Object.fromEntries(new FormData(form).entries()), nome = form.dataset.vpForm, d = estado.dados[estado.aba] || {};
    if (nome === 'pesos') return gravar({ acao: 'pesos', pesos: Object.fromEntries((d.componentes || []).map((c) => [c.id, num(f[c.id])])) }, 'Pesos salvos. O ranking já usa os novos.');
    if (nome === 'metas') return gravar({ acao: 'metas', metas: Object.fromEntries(Object.keys(d.cargos || {}).map((k) => [k, num(f[k])])) }, 'Metas salvas.');
    if (nome === 'pedido') {
      const dias = (d.tipos || []).find((t) => t.id === f.tipo)?.dias;
      return gravar({ acao: 'pedido_criar', tipo: f.tipo, titulo: f.titulo, descricao: f.descricao, inicio: f.tipo === 'ferias' ? f.inicio : null, fim: f.tipo === 'ferias' ? f.fim : null,
        data_desejada: f.tipo === 'ferias' ? null : f.data_desejada || null }, dias ? `Pedido enviado ao RH. Resposta em até ${plural(dias, 'dia útil', 'dias úteis')}.` : 'Pedido enviado ao RH.');
    }
    if (nome === 'responder') {
      const status = botao?.value || 'resolvido', resposta = String(f.resposta || '').trim();
      if (status === 'recusado' && !resposta) { estado.aviso = 'Escreva o motivo da recusa para quem pediu.'; avisar(); return null; }
      return gravar({ acao: 'pedido_status', id: form.dataset.id, status, resposta }, status === 'andamento' ? 'Pedido em andamento.' : 'Resposta enviada.');
    }
    if (nome === 'prazos') return gravar({ acao: 'prazos_rh', prazos: Object.fromEntries((d.tipos || []).filter((t) => t.formulario !== false).map((t) => [t.id, num(f[t.id])])) }, 'Prazos salvos. Valem para os pedidos novos.');
    if (nome === 'pesquisa-abrir') return gravar({ acao: 'pesquisa_abrir', titulo: f.titulo, abre: f.abre, fecha: f.fecha }, 'Pesquisa aberta. A equipe já pode responder.');
    if (nome === 'pesquisa') {
      const r = { acao: 'pesquisa_responder', pesquisa_id: form.dataset.id, enps: num(f.enps), comentario: f.comentario || '' };
      for (const x of d.pesquisa?.dimensoes || []) r[x.id] = num(f[x.id]);
      return gravar(r, 'Resposta enviada sem nome. Obrigado!');
    }
    if (nome === 'meu-aniversario' || nome === 'perfil') {
      const n = nascimentoDoForm(f);
      if (n.erro) { estado.aviso = n.erro; avisar(); return null; }
      if (nome === 'meu-aniversario') return gravar({ acao: 'perfil', nascimento: n.valor }, n.valor ? 'Aniversário salvo.' : 'Aniversário apagado.');
      return gravar({ acao: 'perfil', pessoa_id: f.pessoa_id, nascimento: n.valor, entrada: f.entrada || null, saida: f.saida || null }, 'Datas salvas.');
    }
    if (nome === 'projeto') {
      const etapas = linhas(form, '.vp-etapa-form').map((e) => ({ id: e.e_id || null, nome: e.e_nome, responsavel: e.e_responsavel || null, inicio: e.e_inicio, fim: e.e_fim, esforco: num(e.e_esforco) || 1, feita: e.e_feita === '1' }));
      return gravar({ acao: 'projeto_salvar', id: f.id || null, nome: f.nome, tipo: f.tipo, cliente_id: f.cliente_id || null, cliente: f.cliente_id ? '' : f.cliente || '', status: f.status, inicio: f.inicio, fim: f.fim, descricao: f.descricao, etapas }, 'Projeto salvo.');
    }
    if (nome === 'trilha') {
      const aulas = linhas(form, '.vp-aula-form').map((a) => ({ id: a.a_id || null, titulo: a.a_titulo, tipo: a.a_tipo, link: a.a_link, minutos: num(a.a_minutos) || 10 }));
      return gravar({ acao: 'trilha_salvar', id: f.id || null, nome: f.nome, descricao: f.descricao, aulas }, 'Trilha salva.');
    }
    if (nome === 'atribuir') return gravar({ acao: 'trilha_atribuir', trilha_id: f.trilha_id, pessoa_id: f.pessoa_id, prazo: f.prazo || null }, 'Trilha atribuída.');
    if (nome === 'vaga') return gravar({ acao: 'vaga_salvar', id: f.id || null, titulo: f.titulo, cargo: f.cargo, status: f.status, descricao: f.descricao }, 'Vaga salva.');
    if (nome === 'candidato') return gravar({ acao: 'candidato_salvar', id: f.id || null, vaga_id: f.vaga_id, nome: f.nome, contato: f.contato, etapa: f.etapa, observacao: f.observacao }, 'Candidato salvo.');
    if (nome === 'etapas') return gravar({ acao: 'etapas_recrutamento', etapas: String(f.etapas || '').split('\n').map((s) => s.trim()).filter(Boolean) }, 'Etapas salvas.');
    if (nome === 'documento') return gravar({ acao: 'documento_salvar', id: f.id || null, pessoa_id: f.pessoa_id, tipo: f.tipo, titulo: f.titulo, status: f.status, inicio: f.inicio || null, renovacao: f.renovacao || null, link: f.link, observacao: f.observacao }, 'Documento salvo.');
    return null;
  }
  function abrirForm(nome, editar = null) { estado.form = nome; estado.editar = editar; estado.aviso = ''; pintar(); estado.janela?.querySelector?.(`[data-vp-form="${nome}"] input:not([type=hidden]), [data-vp-form="${nome}"] select`)?.focus?.(); }
  function acrescentar(seletor, html) {
    const alvo = estado.janela?.querySelector?.(seletor); if (!alvo) return;
    alvo.insertAdjacentHTML('beforeend', html); alvo.lastElementChild?.querySelector?.('input:not([type=hidden])')?.focus?.();
  }

  // ---------- eventos ----------
  function trocarAba(aba) {
    if (!DESENHO[aba] || (SO_GESTAO.has(aba) && !gestao())) aba = 'produtividade';
    estado.aba = aba; estado.form = ''; estado.editar = null; estado.aviso = ''; estado.erro = ''; estado.filtroPedidos = '';
    pintar(); window.VybeTutorial?.dica?.('pessoas');
    return carregar(aba);
  }
  function aoClicar(e) {
    const t = e.target, perto = (s) => t?.closest?.(s), d = estado.dados[estado.aba] || {};
    if (t === estado.raiz) { fechar(); return; }
    let b;
    if (perto('[data-vp-fechar]')) fechar();
    else if (perto('[data-vp-ajuda]')) { estado.ajuda = !estado.ajuda; pintar(); }
    else if ((b = perto('[data-vp-aba]'))) trocarAba(b.dataset.vpAba);
    else if (perto('[data-vp-recarregar]')) carregar();
    else if ((b = perto('[data-vp-proj-zoom]'))) { estado.projZoom = b.dataset.vpProjZoom; pintar(); }
    else if ((b = perto('[data-vp-proj-filtro]'))) { estado.projFiltro = b.dataset.vpProjFiltro; pintar(); }
    else if ((b = perto('[data-vp-abrir-form]'))) abrirForm(b.dataset.vpAbrirForm, b.dataset.vpAbrirForm === 'projeto' ? { inicio: hoje(), fim: somarDias(hoje(), 14), etapas: [{}] } : b.dataset.vpAbrirForm === 'trilha' ? { aulas: [{}] } : null);
    else if (perto('[data-vp-fechar-form]')) { estado.form = ''; estado.editar = null; pintar(); }
    else if ((b = perto('[data-vp-pessoa]'))) { estado.pessoa = b.dataset.vpPessoa; carregar(); }
    else if ((b = perto('[data-vp-periodo]'))) { estado.periodo = b.dataset.vpPeriodo; carregar(); }
    else if ((b = perto('[data-vp-carga-semana]'))) { const n = Number(b.dataset.vpCargaSemana), base = d.cargaSemana?.semana || hoje(); estado.semanaCarga = n ? somarDias(base, n) : ''; d.cargaSemana = null; pintar(); carregarCarga(); }
    else if ((b = perto('[data-vp-semana]'))) { const n = Number(b.dataset.vpSemana); estado.semana = n ? somarDias(d.semana || hoje(), n) : ''; carregar(); }
    else if ((b = perto('[data-vp-pedido]'))) gravar({ acao: 'pedido_status', id: b.dataset.vpPedido, status: b.dataset.status }, 'Pedido atualizado.');
    else if ((b = perto('[data-vp-demanda]'))) {
      // A demanda vive no quadro de Solicitações com o id "vybe:<id>" (contrato do servidor, PR #542).
      const bruto = String(b.dataset.vpDemanda), lista = typeof DADOS_DEMANDAS !== 'undefined' && Array.isArray(DADOS_DEMANDAS) ? DADOS_DEMANDAS : [];
      const id = lista.some((x) => String(x.id) === bruto) ? bruto : bruto.startsWith('vybe:') ? bruto : 'vybe:' + bruto;
      if (typeof window.openItemWorkspace === 'function') window.openItemWorkspace(id);
    }
    else if ((b = perto('[data-vp-filtro-pedidos]'))) { estado.filtroPedidos = b.dataset.vpFiltroPedidos; pintar(); }
    else if ((b = perto('[data-vp-cal]'))) { const n = Number(b.dataset.vpCal), base = /^\d{4}-\d{2}$/.test(estado.calMes) ? estado.calMes : hoje().slice(0, 7); estado.calMes = n ? andarMes(base, n) : ''; pintar(); }
    else if ((b = perto('[data-vp-ver-pesquisa]'))) { estado.pesquisaVer = b.dataset.vpVerPesquisa; pintar(); }
    else if ((b = perto('[data-vp-encerrar-pesquisa]'))) {
      if (typeof confirm === 'function' && !confirm('Encerrar a pesquisa agora? Ninguém mais consegue responder.')) return;
      gravar({ acao: 'pesquisa_encerrar', id: b.dataset.vpEncerrarPesquisa }, 'Pesquisa encerrada.');
    }
    else if ((b = perto('[data-vp-editar-projeto]'))) abrirForm('projeto', (d.projetos || []).find((p) => p.id === b.dataset.vpEditarProjeto));
    else if ((b = perto('[data-vp-editar-trilha]'))) abrirForm('trilha', (d.trilhas || []).find((x) => x.id === b.dataset.vpEditarTrilha));
    else if ((b = perto('[data-vp-editar-vaga]'))) abrirForm('vaga', (d.vagas || []).find((x) => x.id === b.dataset.vpEditarVaga));
    else if ((b = perto('[data-vp-editar-candidato]'))) abrirForm('candidato', (d.candidatos || []).find((x) => x.id === b.dataset.vpEditarCandidato));
    else if ((b = perto('[data-vp-editar-documento]'))) abrirForm('documento', (d.documentos || []).find((x) => x.id === b.dataset.vpEditarDocumento));
    else if (perto('[data-vp-nova-etapa]')) acrescentar('[data-vp-etapas]', linhaEtapa({ inicio: hoje(), fim: somarDias(hoje(), 3) }, d.pessoas));
    else if (perto('[data-vp-nova-aula]')) acrescentar('[data-vp-aulas]', linhaAula({}, estado.janela.querySelectorAll('.vp-aula-form').length));
    else if ((b = perto('[data-vp-remover-linha]'))) b.parentElement?.remove?.();
  }
  function aoMudar(e) {
    const t = e.target, ds = t?.dataset || {};
    if ('vpMes' in ds) { estado.mes = t.value; carregar(); }
    else if ('vpProjSel' in ds) { estado.projSel = t.value; pintar(); }
    else if ('vpRef' in ds) { estado.ref = t.value; carregar(); }
    else if ('vpVaga' in ds) { estado.vaga = t.value; pintar(); }
    else if (ds.vpMover) gravar({ acao: 'candidato_mover', id: ds.vpMover, etapa: t.value }, 'Candidato movido.');
    else if (ds.vpEtapa) gravar({ acao: 'etapa_feita', id: ds.vpEtapa, feita: t.checked }, t.checked ? 'Etapa feita.' : 'Etapa reaberta.');
    else if (ds.vpAula) gravar({ acao: 'aula_feita', aula_id: ds.vpAula, feita: t.checked }, t.checked ? 'Aula concluída.' : 'Aula desmarcada.');
    else if ('vpPerfilPessoa' in ds) {
      // Preenche com o que já está salvo, para o Salvar não apagar uma data sem querer.
      const p = (estado.dados.rh?.perfis || []).find((x) => x.pessoa_id === t.value) || {}, form = t.closest('form');
      for (const k of ['entrada', 'saida']) { const i = form?.querySelector(`[name="${k}"]`); if (i) i.value = p[k] || ''; }
      const nasc = /^\d{4}-\d{2}-\d{2}/.test(p.nascimento || '') ? p.nascimento : '', poe = (k, v) => { const i = form?.querySelector(`[name="${k}"]`); if (i) i.value = v; };
      poe('nasc_ano', nasc.slice(0, 4)); poe('nasc_dia', nasc ? String(Number(nasc.slice(8, 10))) : ''); poe('nasc_mes', nasc ? String(Number(nasc.slice(5, 7))) : '');
    }
    else if ('vpTipoPedido' in ds) {
      // Férias ou folga: primeiro e último dia (obrigatórios); os outros tipos: data desejada.
      estado.tipoPedido = t.value;
      const form = t.closest('form'), ferias = t.value === 'ferias', f = form?.querySelector('.vp-ferias'), dz = form?.querySelector('.vp-desejada');
      if (f) { f.hidden = !ferias; for (const i of f.querySelectorAll('input')) i.required = ferias; }
      if (dz) dz.hidden = ferias;
    }
  }
  function aoEnviar(e) { const form = e.target?.closest?.('form[data-vp-form]'); if (!form) return; e.preventDefault(); enviar(form, e.submitter); }
  const visivel = (el) => Boolean(el.getClientRects?.().length);
  function aoTeclar(e) {
    if (e.key !== 'Escape' || !estado.raiz || e.defaultPrevented) return;
    if ([...document.querySelectorAll(ACIMA)].some((el) => !estado.raiz.contains?.(el) && visivel(el))) return;
    e.preventDefault(); e.stopPropagation();
    if (estado.form) { estado.form = ''; estado.editar = null; pintar(); return; }
    if (estado.ajuda) { estado.ajuda = false; pintar(); return; }
    fechar();
  }

  // ---------- API ----------
  function abrir(aba = 'produtividade', opcoes = {}) {
    estado.soAbas = Array.isArray(opcoes.abas) && opcoes.abas.length ? new Set(opcoes.abas) : null; estado.rotulo = opcoes.rotulo || '';
    if (!estado.raiz) {
      estado.antes = document.activeElement || null;
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vp-camada';
      janela.id = 'vv-pessoas'; janela.className = 'vp-janela';
      janela.setAttribute('role', 'dialog'); janela.setAttribute('aria-modal', 'true'); janela.setAttribute('aria-labelledby', 'vp-titulo');
      raiz.append(janela);
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('change', aoMudar); raiz.addEventListener('submit', aoEnviar);
      document.body.append(raiz);
      Object.assign(estado, { raiz, janela });
    }
    const leitura = trocarAba(String(aba || 'produtividade'));
    estado.janela.querySelector?.('[role="tab"][aria-selected="true"]')?.focus?.();
    return leitura;
  }
  function fechar() {
    const { raiz, antes } = estado; if (!raiz) return;
    Object.assign(estado, { raiz: null, janela: null, antes: null, form: '', editar: null, ajuda: false });
    raiz.remove();
    if (antes?.isConnected) antes.focus?.();
  }
  const aberto = () => Boolean(estado.raiz);
  async function carga(semana) {
    const d = await pedir('GET', { aba: 'projetos', semana: semana || '' });
    return { semana: d.semana, fim: d.fim, capacidade: d.capacidade, pessoas: d.carga || [] };
  }

  // Atalho "Nova solicitação ao RH" do Hoje: abre o RH já com o formulário (o form sobrevive à leitura).
  function novoPedido() {
    const leitura = abrir('rh');
    estado.form = 'pedido'; estado.editar = null;
    return Promise.resolve(leitura).then(() => { estado.janela?.querySelector?.('[data-vp-form="pedido"] select')?.focus?.(); });
  }

  window.addEventListener('keydown', aoTeclar, true);
  window.VybePessoas = { abrir, fechar, aberto, carga, novoPedido, _teste: { eventosDoMes, nascimentoDoForm, andarMes } };
})();
