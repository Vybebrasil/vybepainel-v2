// vybe-mundo-pessoas.js — o setor de Pessoas no Irecity (Paulo, 07/11/2026; inspirado no AgencyFlow).
//
//   VybePessoas.abrir(aba = 'produtividade' | 'rh' | 'projetos' | 'academy' | 'recrutamento' | 'documentos')  → Promise
//   VybePessoas.fechar()
//   VybePessoas.aberto()                                                       → boolean
//   VybePessoas.carga(semana?)  → Promise<{ semana, fim, capacidade, pessoas: [{ id, nome, pecas, atrasadas, etapas, total, pct, nivel }] }>
//                                 a carga atual por pessoa (demandas abertas do painel + etapas de projetos
//                                 da semana), para o Comercial cruzar capacidade × vendas.
//
// Os dados e as regras de acesso são do servidor (server/pessoas.js, GET/POST
// /api/painel?area=setor_pessoas); as contas são as de shared/pessoas-calculos.js. A tela só
// mostra o que o servidor mandou: quem não é dono nem administra não recebe ranking, pesos,
// metas, resultado do clima, recrutamento nem documentos — então nem há o que esconder aqui.
// O score sai 100% do que já passa pelo painel (prazo, volume, ajustes, atrasos): ninguém preenche nada.
// Celular primeiro: uma coluna, abas que rolam de lado, kanban e linha do tempo com rolagem própria.
(function () {
  'use strict';
  const ABAS = [['produtividade', 'Produtividade'], ['rh', 'RH'], ['projetos', 'Projetos'], ['academy', 'Academy'], ['recrutamento', 'Recrutamento'], ['documentos', 'Documentos']];
  const SO_GESTAO = new Set(['recrutamento', 'documentos']);
  const DONOS = ['paulo', 'vinicius', 'ewerton', 'deivid'];
  const ACIMA = '#cartao-rapido, #workflow-modal, #workspace-drawer, .brief-overlay, .etq-overlay, dialog[open], #login-gate';
  const URL_API = '/api/painel?area=setor_pessoas';
  const AJUDA = {
    produtividade: 'O score de 0 a 100 sai das demandas do painel, sem nada para preencher: entregas no prazo (a data do cliente manda), volume do mês contra a meta do cargo, peças que voltaram para ajuste e o que está atrasado na fila. Cada pessoa vê só o próprio detalhe; o ranking, os pesos e as metas são dos donos.',
    rh: 'Pedidos ao RH com prazo de resposta por tipo, aniversários (só dia e mês) e férias aprovadas. A pesquisa de clima é trimestral e anônima de verdade: a resposta não guarda quem respondeu nem a hora, e o resultado só aparece somado, com 3 respostas ou mais.',
    projetos: 'Projetos fora do mensal (evento, lançamento, site) com etapas, responsáveis e datas, na linha do tempo. A carga da semana soma as demandas abertas do painel e as etapas de projeto de cada pessoa contra a capacidade semanal.',
    academy: 'Trilhas de treinamento para quem entra na Vybe. Cada aula é um link de vídeo ou documento; marque a aula como feita quando terminar. Os donos montam as trilhas e atribuem a cada pessoa.',
    recrutamento: 'Vagas abertas e os candidatos em cada etapa. As etapas são configuráveis; mover para Aprovado (ou Contratado) conta no tempo médio de contratação. Só os donos e quem administra veem.',
    documentos: 'Contratos e documentos de cada colaborador, com o aviso de renovação nos próximos 30 dias. Sem assinatura eletrônica: o link aponta para o arquivo no Drive. Só os donos e quem administra veem.',
  };
  const NIVEL = { sobrecarregada: ['Sobrecarregada', 'u2'], cheia: ['Cheia', 'u4'], ok: ['Em dia', 'u6'], leve: ['Folga', 'u5'] };
  const SLA = { atrasado: ['Atrasado', 'u1'], vence_hoje: ['Vence hoje', 'u2'], no_prazo: ['No prazo', 'u6'], encerrado: ['Encerrado', 'u5'], sem_prazo: ['Sem prazo', 'u5'] };
  const DOC = { vencido: ['Vencido', 'u1'], renovar: ['Renovar em breve', 'u2'], em_dia: ['Em dia', 'u6'], sem_renovacao: ['Sem renovação', 'u5'], encerrado: ['Encerrado', 'u5'] };
  const TIPOS_PROJETO = { evento: 'Evento', lancamento: 'Lançamento', site: 'Site', campanha: 'Campanha', outro: 'Outro' };
  const STATUS_PROJETO = { planejado: 'Planejado', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
  const estado = { raiz: null, janela: null, antes: null, aba: 'produtividade', dados: {}, carregando: false, erro: '', aviso: '', ajuda: false, form: '', editar: null,
    mes: '', pessoa: '', periodo: 'mensal', ref: '', semana: '', vaga: '' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const primeiroNome = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().split(/\s+/)[0];
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
    const u = typeof operadorDoTopo === 'function' ? operadorDoTopo() : null;
    return Boolean(u && DONOS.includes(primeiroNome(u.name || u.nome)));
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
  }
  async function gravar(corpo, sucesso) {
    estado.aviso = 'Salvando…'; avisar();
    try {
      await pedir('POST', {}, corpo);
      estado.aviso = sucesso; estado.form = ''; estado.editar = null;
      await carregar();
    } catch (e) { estado.aviso = e.message; avisar(); }
  }

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
  function linhaPedido(p, d) {
    const [, cls] = SLA[p.sla] || SLA.sem_prazo, encerrado = p.sla === 'encerrado';
    const status = (d.status || {})[p.status] || p.status;
    const proprio = p.pessoa_id === d.eu?.id;
    const botoes = d.gestao && !encerrado
      ? `${p.status === 'aberto' ? sec('Em andamento', `data-vp-pedido="${esc(p.id)}" data-status="andamento"`) : ''}${sec(p.tipo === 'ferias' ? 'Aprovar' : 'Resolver', `data-vp-pedido="${esc(p.id)}" data-status="resolvido"`)}${sec('Recusar', `data-vp-pedido="${esc(p.id)}" data-status="recusado"`)}`
      : proprio && p.status === 'aberto' ? sec('Cancelar', `data-vp-pedido="${esc(p.id)}" data-status="cancelado"`) : '';
    return `<li class="vp-item ${cls}"><div class="vp-meio"><b>${esc(p.titulo)}</b>
      <small>${d.gestao ? esc(p.pessoa_nome) + ' · ' : ''}${esc((d.tipos || []).find((t) => t.id === p.tipo)?.nome || p.tipo)}${p.inicio ? ` · ${br(p.inicio)} a ${br(p.fim)}` : ''} · prazo ${br(p.prazo)}</small>
      ${p.resposta ? `<small class="vp-resposta">${esc(p.resposta)}</small>` : ''}</div>
      <div class="vp-lado">${encerrado ? chip([p.tipo === 'ferias' && p.status === 'resolvido' ? 'Aprovado' : status, 'u5']) : chip(SLA[p.sla] || SLA.sem_prazo)}${encerrado ? '' : `<small>${esc(status)}</small>`}</div>
      ${botoes ? `<div class="vp-botoes">${botoes}</div>` : ''}</li>`;
  }
  function formPedido(d) {
    return `<form data-vp-form="pedido" class="vp-cartao vp-form">
      <label><span>Tipo</span><select name="tipo" data-vp-tipo-pedido>${(d.tipos || []).map((t) => `<option value="${esc(t.id)}">${esc(t.nome)} (resposta em ${esc(t.dias)} dias úteis)</option>`).join('')}</select></label>
      <label><span>Assunto</span><input name="titulo" maxlength="200" required placeholder="Ex.: declaração de vínculo"></label>
      <label><span>Detalhes</span><textarea name="descricao" maxlength="2000" rows="3"></textarea></label>
      <div class="vp-grade vp-ferias" hidden><label><span>Início das férias</span><input type="date" name="inicio"></label><label><span>Fim</span><input type="date" name="fim"></label></div>
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Enviar ao RH</button></div></form>`;
  }
  function htmlClima(d) {
    const c = d.clima || {};
    let html = `<h3 class="vp-titulo">Clima da equipe <small>${esc(c.trimestre || '')} · anônimo</small></h3>`;
    if (c.respondeu) html += vazio('Obrigado por responder', 'A sua resposta entrou sem nome nem hora. A próxima pesquisa abre no trimestre que vem.');
    else if (estado.form !== 'clima') html += vazio('Como está a Vybe para você?', 'Seis perguntas rápidas, sem nome: ninguém vê a sua resposta, nem os donos.', acao('Responder a pesquisa', 'data-vp-abrir-form="clima"'));
    else {
      const escala = (nome, de, ate) => `<div class="vp-escala" role="radiogroup">${Array.from({ length: ate - de + 1 }, (_, i) => de + i).map((n) => `<label><input type="radio" name="${nome}" value="${n}" required><span>${n}</span></label>`).join('')}</div>`;
      html += `<form data-vp-form="clima" class="vp-cartao vp-form">
        <fieldset><legend>De 0 a 10, quanto você recomendaria a Vybe para um amigo trabalhar?</legend>${escala('enps', 0, 10)}</fieldset>
        ${(c.dimensoes || []).map((x) => `<fieldset><legend>${esc(x.nome)} <small>1 = muito ruim · 5 = ótimo</small></legend>${escala(x.id, 1, 5)}</fieldset>`).join('')}
        <label><span>Quer dizer mais alguma coisa? (opcional)</span><textarea name="comentario" maxlength="1000" rows="3"></textarea></label>
        <p class="vp-nota">O comentário só aparece misturado aos outros, e só com ${esc(c.minimo || 3)} respostas ou mais. Evite escrever algo que identifique você.</p>
        <div class="vp-botoes">${sec('Agora não', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Enviar anônimo</button></div></form>`;
    }
    const r = d.climaResultado;
    if (d.gestao && r) {
      if (!r.liberado) html += `<p class="vp-nota">${plural(r.respostas, 'resposta', 'respostas')} em ${esc(r.trimestre)}. O resultado aparece com ${esc(r.minimo)} ou mais, para ninguém ser identificado.</p>`;
      else html += `<div class="vp-cartao"><div class="vp-kpis">${kpi('eNPS', r.enps)}${kpi('Respostas', r.respostas)}${kpi('Promotores', r.promotores)}${kpi('Detratores', r.detratores)}</div>
        <ul class="vp-comps">${r.dimensoes.map((x) => `<li><span>${esc(x.nome)}</span><span class="vp-barra" aria-hidden="true"><i style="width:${x.media / 5 * 100}%"></i></span><b>${esc(String(x.media).replace('.', ','))}</b></li>`).join('')}</ul>
        ${r.comentarios?.length ? `<ul class="vp-comentarios">${r.comentarios.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>`;
    }
    return html;
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
    const abertos = (d.pedidos || []).filter((p) => p.sla !== 'encerrado');
    html += `<div class="vp-linha-topo"><h3 class="vp-titulo">${d.gestao ? 'Pedidos ao RH' : 'Seus pedidos ao RH'}</h3>${estado.form === 'pedido' ? '' : acao('Novo pedido', 'data-vp-abrir-form="pedido"')}</div>`;
    if (estado.form === 'pedido') html += formPedido(d);
    html += (d.pedidos || []).length ? `<ul class="vp-lista">${[...abertos, ...(d.pedidos || []).filter((p) => p.sla === 'encerrado').slice(0, 10)].map((p) => linhaPedido(p, d)).join('')}</ul>`
      : estado.form === 'pedido' ? '' : vazio('Nenhum pedido por aqui', 'Precisa de uma declaração, de férias ou de algo do RH? Abra um pedido e acompanhe o prazo.');
    const aniv = proximosAniversarios(d.aniversarios);
    html += `<h3 class="vp-titulo">Calendário</h3><div class="vp-duas">
      <div class="vp-cartao"><span class="vp-kicker">Aniversários</span>${aniv.length ? `<ul class="vp-simples">${aniv.map((a) => `<li><b>${esc(a.dia.slice(3))}/${esc(a.dia.slice(0, 2))}</b> ${esc(a.nome)}</li>`).join('')}</ul>` : '<p class="vp-nota">Ninguém cadastrou o aniversário ainda.</p>'}
        <form data-vp-form="meu-aniversario" class="vp-form vp-inline"><label><span>Seu aniversário</span><input type="date" name="nascimento" value="${esc(d.meuPerfil?.nascimento || '')}"></label><button type="submit" class="vp-sec">Salvar</button></form>
        <p class="vp-nota">Para a equipe aparecem só o dia e o mês.</p></div>
      <div class="vp-cartao"><span class="vp-kicker">Férias aprovadas</span>${(d.ferias || []).length ? `<ul class="vp-simples">${d.ferias.map((f) => `<li><b>${br(f.inicio)}–${br(f.fim)}</b> ${esc(f.nome)}</li>`).join('')}</ul>` : '<p class="vp-nota">Nenhuma férias marcada para os próximos dias.</p>'}</div></div>`;
    if (d.gestao) {
      const pessoas = d.pessoas || [];
      html += `<details class="vp-cartao vp-det"><summary>Datas de RH (entrada, saída e aniversário)</summary>
        <form data-vp-form="perfil" class="vp-form vp-grade"><label><span>Pessoa</span><select name="pessoa_id" required data-vp-perfil-pessoa>${pessoasOpcoes(pessoas, '', 'Escolha')}</select></label>
        <label><span>Aniversário</span><input type="date" name="nascimento"></label><label><span>Entrada na Vybe</span><input type="date" name="entrada"></label><label><span>Saída</span><input type="date" name="saida"></label>
        <div class="vp-botoes"><button type="submit" class="vp-acao">Salvar datas</button></div></form></details>`;
    }
    return html + htmlClima(d);
  }

  // ---------- Projetos ----------
  function htmlCarga(d) {
    const semana = d.semana || '';
    return `<div class="vp-linha-topo"><h3 class="vp-titulo">Carga da semana <small>${br(semana)} a ${br(d.fim)} · capacidade ${esc(d.capacidade)} itens</small></h3>
      <div class="vp-nav">${sec('‹', 'data-vp-semana="-7" aria-label="Semana anterior"')}${sec('Hoje', 'data-vp-semana="0"')}${sec('›', 'data-vp-semana="7" aria-label="Próxima semana"')}</div></div>
      ${(d.carga || []).length ? `<ul class="vp-lista vp-carga">${d.carga.map((c) => `<li class="vp-item"><div class="vp-meio"><b>${esc(c.nome)}</b>
        <small>${plural(c.pecas, 'demanda', 'demandas')}${c.atrasadas ? ` · ${c.atrasadas} atrasada${c.atrasadas === 1 ? '' : 's'}` : ''}${c.etapas ? ` · ${plural(c.etapas, 'ponto', 'pontos')} de projeto` : ''}</small>
        <span class="vp-barra larga ${NIVEL[c.nivel][1]}" aria-hidden="true"><i style="width:${Math.min(100, c.pct)}%"></i></span></div>
        <div class="vp-lado">${chip(NIVEL[c.nivel])}<small>${esc(c.pct)}%</small></div></li>`).join('')}</ul>` : vazio('Ninguém na equipe ainda', '')}`;
  }
  function htmlGantt(d) {
    const l = d.linha || {};
    if (!(l.projetos || []).length) return vazio('Nenhum projeto pontual', 'Evento, lançamento ou site fora do mensal: crie o projeto com as etapas e veja tudo na linha do tempo.', d.gestao ? acao('Novo projeto', 'data-vp-abrir-form="projeto"') : '');
    const largura = Math.max(560, (l.semanas || []).length * 90);
    return `<div class="vp-gantt" role="region" aria-label="Linha do tempo dos projetos" tabindex="0"><div class="vp-gantt-in" style="min-width:${largura}px">
      <div class="vp-gantt-semanas">${l.semanas.map((s) => `<span style="left:${s.esq}%">${br(s.inicio)}</span>`).join('')}</div>
      ${l.hoje != null ? `<div class="vp-gantt-agora" aria-hidden="true"><i style="left:${l.hoje}%"></i></div>` : ''}
      ${l.projetos.map((p) => `<div class="vp-gantt-proj"><div class="vp-gantt-nome"><b>${esc(p.nome)}</b><small>${esc(TIPOS_PROJETO[p.tipo] || '')}${p.cliente ? ' · ' + esc(p.cliente) : ''} · ${esc(STATUS_PROJETO[p.status] || '')}</small>
          ${d.gestao ? `<button type="button" class="vp-link" data-vp-editar-projeto="${esc(p.id)}">Editar</button>` : ''}</div>
        ${p.pos ? `<div class="vp-gantt-trilho"><span class="vp-gantt-barra proj" style="left:${p.pos.esq}%;width:${p.pos.larg}%"></span></div>` : ''}
        ${p.etapas.map((e) => {
          const pode = d.gestao || e.responsavel === d.eu?.id;
          return `<div class="vp-gantt-etapa"><label class="vp-gantt-rotulo"><input type="checkbox" data-vp-etapa="${esc(e.id)}"${e.feita ? ' checked' : ''}${pode ? '' : ' disabled'}><span>${esc(e.nome)}<small>${esc(e.responsavel_nome || 'sem responsável')} · ${br(e.inicio)}–${br(e.fim)}</small></span></label>
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
      <label><span>Cliente</span><input name="cliente" maxlength="200" value="${esc(p.cliente || '')}"></label>
      <label><span>Status</span><select name="status">${opcoes(STATUS_PROJETO, p.status || 'planejado')}</select></label>
      <label><span>Início</span><input type="date" name="inicio" required value="${esc(p.inicio || '')}"></label>
      <label><span>Fim</span><input type="date" name="fim" required value="${esc(p.fim || '')}"></label></div>
      <label><span>Descrição</span><textarea name="descricao" maxlength="2000" rows="2">${esc(p.descricao || '')}</textarea></label>
      <span class="vp-kicker">Etapas</span><div class="vp-etapas" data-vp-etapas>${(p.etapas || []).map((e) => linhaEtapa(e, d.pessoas)).join('')}</div>
      ${sec('Adicionar etapa', 'data-vp-nova-etapa')}
      <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar projeto</button></div></form>`;
  }
  function htmlProjetos(d) {
    let html = semMigracao(d) + htmlCarga(d);
    html += `<div class="vp-linha-topo"><h3 class="vp-titulo">Projetos pontuais</h3>${d.gestao && estado.form !== 'projeto' && (d.projetos || []).length ? acao('Novo projeto', 'data-vp-abrir-form="projeto"') : ''}</div>`;
    if (estado.form === 'projeto') html += formProjeto(d);
    return html + htmlGantt(d);
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
    const g = gestao(), abas = ABAS.filter(([k]) => g || !SO_GESTAO.has(k));
    return `<div class="vp-topo"><div><span class="vp-kicker">Pessoas</span><h2 id="vp-titulo">${esc((ABAS.find(([k]) => k === estado.aba) || ABAS[0])[1])}</h2></div>
        <div class="vp-topo-botoes"><button type="button" class="vp-x" data-vp-ajuda aria-expanded="${estado.ajuda}" aria-label="O que é esta aba" title="O que é esta aba">?</button>
        <button type="button" class="vp-x" data-vp-fechar aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div></div>
      ${estado.ajuda ? `<p class="vp-ajuda" role="note">${esc(AJUDA[estado.aba])}</p>` : ''}
      <div class="vp-abas" role="tablist" aria-label="Partes do setor de Pessoas">${abas.map(([k, r]) => `<button type="button" role="tab" id="vp-aba-${k}" aria-controls="vp-corpo" aria-selected="${k === estado.aba}" data-vp-aba="${k}">${esc(r)}</button>`).join('')}</div>
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
  function enviar(form) {
    const f = Object.fromEntries(new FormData(form).entries()), nome = form.dataset.vpForm, d = estado.dados[estado.aba] || {};
    if (nome === 'pesos') return gravar({ acao: 'pesos', pesos: Object.fromEntries((d.componentes || []).map((c) => [c.id, num(f[c.id])])) }, 'Pesos salvos. O ranking já usa os novos.');
    if (nome === 'metas') return gravar({ acao: 'metas', metas: Object.fromEntries(Object.keys(d.cargos || {}).map((k) => [k, num(f[k])])) }, 'Metas salvas.');
    if (nome === 'pedido') return gravar({ acao: 'pedido_criar', tipo: f.tipo, titulo: f.titulo, descricao: f.descricao, inicio: f.tipo === 'ferias' ? f.inicio : null, fim: f.tipo === 'ferias' ? f.fim : null }, 'Pedido enviado ao RH.');
    if (nome === 'meu-aniversario') return gravar({ acao: 'perfil', nascimento: f.nascimento || null }, 'Aniversário salvo.');
    if (nome === 'perfil') return gravar({ acao: 'perfil', pessoa_id: f.pessoa_id, nascimento: f.nascimento || null, entrada: f.entrada || null, saida: f.saida || null }, 'Datas salvas.');
    if (nome === 'clima') {
      const r = { acao: 'clima_responder', enps: num(f.enps), comentario: f.comentario || '' };
      for (const x of d.clima?.dimensoes || []) r[x.id] = num(f[x.id]);
      return gravar(r, 'Resposta enviada sem nome. Obrigado!');
    }
    if (nome === 'projeto') {
      const etapas = linhas(form, '.vp-etapa-form').map((e) => ({ id: e.e_id || null, nome: e.e_nome, responsavel: e.e_responsavel || null, inicio: e.e_inicio, fim: e.e_fim, esforco: num(e.e_esforco) || 1, feita: e.e_feita === '1' }));
      return gravar({ acao: 'projeto_salvar', id: f.id || null, nome: f.nome, tipo: f.tipo, cliente: f.cliente, status: f.status, inicio: f.inicio, fim: f.fim, descricao: f.descricao, etapas }, 'Projeto salvo.');
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
    estado.aba = aba; estado.form = ''; estado.editar = null; estado.aviso = ''; estado.erro = '';
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
    else if ((b = perto('[data-vp-abrir-form]'))) abrirForm(b.dataset.vpAbrirForm, b.dataset.vpAbrirForm === 'projeto' ? { inicio: hoje(), fim: somarDias(hoje(), 14), etapas: [{}] } : b.dataset.vpAbrirForm === 'trilha' ? { aulas: [{}] } : null);
    else if (perto('[data-vp-fechar-form]')) { estado.form = ''; estado.editar = null; pintar(); }
    else if ((b = perto('[data-vp-pessoa]'))) { estado.pessoa = b.dataset.vpPessoa; carregar(); }
    else if ((b = perto('[data-vp-periodo]'))) { estado.periodo = b.dataset.vpPeriodo; carregar(); }
    else if ((b = perto('[data-vp-semana]'))) { const n = Number(b.dataset.vpSemana); estado.semana = n ? somarDias(d.semana || hoje(), n) : ''; carregar(); }
    else if ((b = perto('[data-vp-pedido]'))) gravar({ acao: 'pedido_status', id: b.dataset.vpPedido, status: b.dataset.status }, 'Pedido atualizado.');
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
    else if ('vpRef' in ds) { estado.ref = t.value; carregar(); }
    else if ('vpVaga' in ds) { estado.vaga = t.value; pintar(); }
    else if (ds.vpMover) gravar({ acao: 'candidato_mover', id: ds.vpMover, etapa: t.value }, 'Candidato movido.');
    else if (ds.vpEtapa) gravar({ acao: 'etapa_feita', id: ds.vpEtapa, feita: t.checked }, t.checked ? 'Etapa feita.' : 'Etapa reaberta.');
    else if (ds.vpAula) gravar({ acao: 'aula_feita', aula_id: ds.vpAula, feita: t.checked }, t.checked ? 'Aula concluída.' : 'Aula desmarcada.');
    else if ('vpPerfilPessoa' in ds) {
      // Preenche com o que já está salvo, para o Salvar não apagar uma data sem querer.
      const p = (estado.dados.rh?.perfis || []).find((x) => x.pessoa_id === t.value) || {}, form = t.closest('form');
      for (const k of ['nascimento', 'entrada', 'saida']) { const i = form?.querySelector(`[name="${k}"]`); if (i) i.value = p[k] || ''; }
    }
    else if ('vpTipoPedido' in ds) { const f = t.closest('form')?.querySelector('.vp-ferias'); if (f) f.hidden = t.value !== 'ferias'; }
  }
  function aoEnviar(e) { const form = e.target?.closest?.('form[data-vp-form]'); if (!form) return; e.preventDefault(); enviar(form); }
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
  function abrir(aba = 'produtividade') {
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

  window.addEventListener('keydown', aoTeclar, true);
  window.VybePessoas = { abrir, fechar, aberto, carga };
})();
