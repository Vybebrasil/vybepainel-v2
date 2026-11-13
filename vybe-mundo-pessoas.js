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
  // A frase do cabeçalho de cada aba (Padrão Vybe: título, uma frase do que a tela faz e a ação à direita).
  const FRASE = {
    produtividade: 'Entregas no prazo, volume e ritmo de cada pessoa, direto das demandas do painel.',
    rh: 'Pedidos ao RH com prazo de resposta, o calendário do time e a pesquisa de clima.',
    projetos: 'Projetos fora do mensal, com etapas, responsáveis e datas.',
    academy: 'Trilhas de treinamento para quem entra na Vybe.',
    recrutamento: 'Vagas abertas e os candidatos em cada etapa.',
    documentos: 'Contratos e documentos de cada colaborador, com o aviso de renovação.',
  };
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
  const TIPOS_PROJETO = { evento: 'Evento', lancamento: 'Lançamento', site: 'Site', campanha: 'Campanha', outro: 'Outro' };
  const STATUS_PROJETO = { planejado: 'Planejado', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

  const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date());
  const estado = { raiz: null, janela: null, antes: null, aba: 'produtividade', dados: {}, carregando: false, erro: '', aviso: '', ajuda: false, form: '', editar: null,
    mes: '', pessoa: '', periodo: 'mensal', ref: '', semana: '', vaga: '', tipoPedido: '', filtroPedidos: '', pesquisaVer: '', calMes: '' };
  // O que as telas do padrão v2 guardam enquanto a aba está aberta: busca, ficha do filtro, linha aberta, cartão do baralho.
  const v2Novo = () => ({ busca: '', filtro: '', tipo: '', filtros: false, aberta: '', mostrar: {}, carta: 0, recusando: '', ver: '' });
  estado.v2 = v2Novo();

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const br = (iso) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  // Cabeçalho único da janela (vbCabecalhoHtml e vbFecharHtml, vybe-core.js). Sem o vybe-core (testes), só o título e as ações.
  const cabecalho = (o) => (typeof window !== 'undefined' && typeof window.vbCabecalhoHtml === 'function' ? window.vbCabecalhoHtml(o) : `<h2${o.id ? ` id="${o.id}"` : ''}>${esc(o.titulo)}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.acoes || ''}`);
  const botaoX = (attr, classe = '') => (typeof window !== 'undefined' && typeof window.vbFecharHtml === 'function' ? window.vbFecharHtml(attr, classe) : `<button type="button" class="vb-janela-x ${classe}" ${attr} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`);
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
  // Escolha em chip do sistema (vbEscolhaHtml, vybe-core.js) no lugar do select nativo (quadros 21 e 61, 10/11/2026).
  // Sem o vybe-core (testes), só o campo escondido com o valor.
  const escolha = (o) => (typeof window.vbEscolhaHtml === 'function' ? window.vbEscolhaHtml(o) : `<input type="hidden" ${o.campo || ''} value="${esc(o.valor ?? '')}">`);
  // A ação principal de cada aba fica no cabeçalho da janela, uma vez só (quadros 21, 40 e 61): o vazio não repete o botão.
  function acaoDoTopo(d) {
    if (!d || d.proibido) return '';
    const a = estado.aba, f = estado.form;
    if (a === 'rh' && f !== 'pedido') return acao('Nova solicitação', 'data-vp-abrir-form="pedido"');
    if (a === 'recrutamento' && f !== 'vaga') return acao('Nova vaga', 'data-vp-abrir-form="vaga"');
    if (a === 'documentos' && f !== 'documento') return acao('Novo documento', 'data-vp-abrir-form="documento"');
    if (a === 'projetos' && d.gestao && f !== 'projeto') return acao('Novo projeto', 'data-vp-abrir-form="projeto"');
    if (a === 'academy' && d.gestao && d.provisionado !== false && f !== 'trilha') return acao('Nova trilha', 'data-vp-abrir-form="trilha"');
    // Quem não monta trilhas pede uma ao RH (quadro da Academy): abre a solicitação já com o assunto.
    if (a === 'academy' && d.gestao === false) return acao('Pedir uma trilha', 'data-v2p-pedir-trilha');
    return '';
  }
  const semMigracao = (d) => (d?.provisionado === false ? '<p class="vp-nota">Esta parte ainda não foi ligada: o que você vê é o começo. Os donos já sabem o que falta.</p>' : '');
  function versus(v, { menorMelhor = false, unidade = '' } = {}) {
    if (!v || v.delta == null) return '<small class="vp-vs">sem base no período anterior</small>';
    if (v.delta === 0) return '<small class="vp-vs">igual ao período anterior</small>';
    const bom = menorMelhor ? v.delta < 0 : v.delta > 0;
    return `<small class="vp-vs ${bom ? 'bom' : 'ruim'}">${v.delta > 0 ? '▲' : '▼'} ${esc(Math.abs(v.delta))}${unidade} vs ${estado.periodo === 'anual' ? 'ano' : 'mês'} anterior</small>`;
  }
  const kpi = (rotulo, valor, extra = '') => `<div class="vp-kpi"><span>${esc(rotulo)}</span><b>${esc(valor ?? '—')}</b>${extra}</div>`;
  // Mês no seletor de período do padrão (vbMesHtml, vybe-core.js): ‹ novembro de 2026 ›, não um campo de texto
  // (quadro 30 do moodboard). Sem o vybe-core (testes) devolve vazio e quem chama mantém o campo.
  const mesHtml = (mes, attr, ano = false) => (typeof window !== 'undefined' && typeof window.vbMesHtml === 'function' ? window.vbMesHtml({ mes, max: hoje().slice(0, 7), attr, ano }) : '');
  function seletorPeriodo() {
    const ref = estado.ref || hoje().slice(0, 7);
    return `<div class="vp-periodo"><div class="vp-seg" role="group" aria-label="Período">
        <button type="button" data-vp-periodo="mensal" aria-pressed="${estado.periodo !== 'anual'}">Mensal</button>
        <button type="button" data-vp-periodo="anual" aria-pressed="${estado.periodo === 'anual'}">Anual</button></div>
      ${mesHtml(ref, 'data-vp-ref-ir', estado.periodo === 'anual') || `<label class="vp-campo-inline"><span class="vp-sr">Mês de referência</span><input type="month" data-vp-ref value="${esc(ref)}" max="${esc(hoje().slice(0, 7))}"></label>`}</div>`;
  }

  // ---------- Padrão v2 (moodboard aprovado em 12/11/2026) ----------
  // Produtividade, Pedidos e calendário, Recrutamento, Documentos e Academy seguem os quadros "Depois": título com a ação, a fala do
  // VYBES, três números, uma barra de filtro, "Pede ação" antes da lista e a linha que abre no lugar. As peças abaixo
  // são as do quadro (cartão, pílula, botão de 38 e de 30, ficha preta quando escolhida); o CSS fica em padrao-v2/pessoas.css.
  const V2 = new Set(['produtividade', 'rh', 'projetos', 'recrutamento', 'documentos', 'academy']);
  const NOME_DIA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const SETA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const diaIso = (v) => String(v || '').slice(0, 10);
  const entre = (a, b) => Math.round((Date.parse(diaIso(b) + 'T12:00:00Z') - Date.parse(diaIso(a) + 'T12:00:00Z')) / 864e5);
  // "hoje", "amanhã", "sexta" (ou "na sexta") e, mais longe, "20/11" (ou "em 20/11").
  function dataFalada(iso, h, prep = false) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return '';
    const n = entre(h, iso), w = new Date(diaIso(iso) + 'T12:00:00Z').getUTCDay();
    if (n === 0) return 'hoje';
    if (n === 1) return 'amanhã';
    if (n > 1 && n < 7) return (prep ? (w === 0 || w === 6 ? 'no ' : 'na ') : '') + NOME_DIA[w];
    return (prep ? 'em ' : '') + br(iso);
  }
  const iniciais = (n) => (primeiroNome(n).slice(0, 2) || '?').toUpperCase();
  const av = (nome, cls = '') => `<span class="v2p-av${cls ? ' ' + cls : ''}" aria-hidden="true">${esc(iniciais(nome))}</span>`;
  const pilula = (texto, tom = 'n', attrs = '') => `<span class="v2p-pill ${tom}"${attrs ? ' ' + attrs : ''}>${esc(texto)}</span>`;
  const botao = (texto, attrs, cls = '') => `<button type="button" class="v2p-btn${cls ? ' ' + cls : ''}" ${attrs}>${esc(texto)}</button>`;
  const elo = (texto, attrs) => `<button type="button" class="v2p-link" ${attrs}>${esc(texto)}</button>`;
  const cabeca = (titulo, sub = '') => `<div class="v2p-cab"><h3>${esc(titulo)}</h3>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const falaHtml = (papel, frase, extra = '', quem = 'VYBES') => `<section class="v2p-card v2p-fala" aria-label="${esc(quem)}, ${esc(papel)}"><span class="v2p-ag" aria-hidden="true">${esc(quem.charAt(0))}</span><p><span class="v2p-quem">${esc(quem)} · ${esc(papel)}</span>${frase}</p>${extra}</section>`;
  // Três números no alto. itens: [{ rotulo, valor, sub (HTML), tom: 'ruim' | 'atencao' | '', barra: 0 a 100, attrs }].
  const tresHtml = (itens) => `<div class="v2p-tres">${itens.map((k, i) => `<div class="v2p-card v2p-kpi${k.tom ? ' ' + k.tom : ''}"${k.attrs ? ' ' + k.attrs : ''}><small>${esc(k.rotulo)}</small><b><span class="v2-num"${i ? ` style="animation-delay:${(i * .12).toFixed(2)}s"` : ''}>${esc(k.valor ?? 0)}</span></b>${k.barra == null ? '' : `<div class="v2-barra"><i style="--v:${Math.round(k.barra)}%;--c:${k.cor || '#11613A'}"></i></div>`}<small>${k.sub || ''}</small></div>`).join('')}</div>`;
  // Fichas do filtro: [[valor, rótulo, quantos]]; a escolhida fica preta.
  const fichasHtml = (lista, atual, attr = 'data-v2p-filtro') => lista.map(([k, r, n]) => `<button type="button" class="v2p-chip" aria-pressed="${k === atual}" ${attr}="${esc(k)}">${esc(r)}${n == null ? '' : ` <b>${esc(n)}</b>`}</button>`).join('');
  const buscaHtml = (rotulo) => `<input type="search" class="v2p-busca" data-v2p-busca placeholder="${esc(rotulo)}" aria-label="${esc(rotulo)}" value="${esc(estado.v2.busca)}">`;
  const bate = (...textos) => { const t = estado.v2.busca.trim().toLowerCase(); return !t || textos.join(' ').toLowerCase().includes(t); };
  // Linha que abre no lugar (.v2-abre de vybe-mundo.css): o nome e a seta abrem; `meio` são as pílulas entre os dois.
  function linhaAbre(id, nomeHtml, meio, detalhe, rotulo) {
    const aberta = estado.v2.aberta === String(id);
    return `<div class="v2-abre v2p-linha" data-linha="${esc(id)}" aria-expanded="${aberta}"><div class="v2p-lin">
        <button type="button" class="v2p-nome" data-v2p-abre="${esc(id)}">${nomeHtml}</button>${meio}
        <button type="button" class="v2p-seta" data-v2p-abre="${esc(id)}" aria-expanded="${aberta}" aria-label="${aberta ? 'Fechar' : 'Abrir'} ${esc(rotulo)}">${SETA}</button></div>
      <div class="v2-mais"><div>${detalhe}</div></div></div>`;
  }
  const recolhe = (lista, chave, max) => (estado.v2.mostrar[chave] ? lista : lista.slice(0, max));
  const restoHtml = (n, chave, texto) => (n > 0 && !estado.v2.mostrar[chave] ? `<p class="v2p-sub v2p-resto">+ ${n} ${esc(texto)} · ${elo('mostrar', `data-v2p-mostrar="${chave}"`)}</p>` : '');

  // ---------- Produtividade ----------
  // Pelo quadro: a fala do Alex, três números, "Pede ação", as conquistas e "O mês de cada um" com a linha que abre no
  // lugar. O painel mede uma meta por pessoa (as entregas do cargo no mês); o detalhe mostra os componentes do score.
  // A carga da semana, os pesos e as metas por cargo (só dos donos) ficam a um clique, em "Também aqui".
  const COR_SCORE = (s) => (s == null ? '#C9C2B6' : s >= 70 ? '#11613A' : '#9A5B00');
  const subDoMes = (p) => [p.meta ? `${p.entregues ?? 0} de ${p.meta} entregas` : plural(p.entregues ?? 0, 'entrega', 'entregas'), (p.conquistas || []).length ? plural(p.conquistas.length, 'conquista', 'conquistas') : 'sem conquista ainda'].join(' · ');
  function detalheDoMes(p, comps) {
    return `<div class="v2p-det v2p-det-mes"><div>${comps.map((c) => { const v = p.componentes?.[c.id], pct = v == null ? null : Math.round(v * 100);
      return `<p class="v2p-meta"><i class="v2p-cx${pct != null && pct >= 80 ? ' ok' : ''}" aria-hidden="true">${CHECK}</i><span>${esc(c.nome)}</span><b>${pct == null ? 'sem dado' : pct + '%'}</b></p>`; }).join('')}
        ${(p.frases || []).length ? `<p class="v2p-sub">${esc(p.frases.join(' · '))}</p>` : ''}</div>
      <div><p class="v2p-sub v2p-det-t">Conquistas</p>${(p.conquistas || []).length ? `<p class="v2p-pills v2p-pills-e">${p.conquistas.map((c) => pilula(c.titulo, 'g', c.texto ? `title="${esc(c.texto)}"` : '')).join('')}</p>` : '<p class="v2p-sub">As conquistas do mês aparecem aqui quando chegarem.</p>'}</div></div>`;
  }
  function linhaDoMes(p, comps, fixa = false) {
    const nome = `${av(p.nome)}<span><b>${esc(primeiroNome(p.nome))}</b> <span class="v2p-sub">· ${esc(subDoMes(p))}</span></span>`;
    const meio = `<div class="v2-barra v2p-barra-lin"><i style="--v:${p.score ?? 0}%;--c:${COR_SCORE(p.score)}"></i></div><b class="v2p-sc">${p.score ?? '–'}</b>`;
    if (fixa) return `<div class="v2p-linha" aria-expanded="true"><div class="v2p-lin"><div class="v2p-nome">${nome}</div>${meio}</div>${detalheDoMes(p, comps)}</div>`;
    return linhaAbre(p.id, nome, meio, detalheDoMes(p, comps), `o mês de ${p.nome}`);
  }
  function tambemProdutividade(d) {
    if (!d.gestao) return '';
    const v = estado.v2.ver, pesos = d.pesos || {};
    const corpo = v === 'carga' ? htmlCarga(d.cargaSemana)
      : v === 'pesos' ? `<h3 class="vp-titulo">Pesos do score</h3><form data-vp-form="pesos" class="vp-form vp-grade">${(d.componentes || []).map((c) => `<label><span>${esc(c.nome)}</span><input type="number" name="${esc(c.id)}" min="0" max="100" step="1" value="${esc(pesos[c.id])}" inputmode="numeric" required></label>`).join('')}
          <p class="vp-nota">O score é a média ponderada: o peso conta em relação aos outros (não precisa somar 100).</p><div class="vp-botoes"><button type="submit" class="vp-acao">Salvar pesos</button></div></form>`
        : v === 'metas' ? `<h3 class="vp-titulo">Metas de entregas por cargo <small>no mês</small></h3><form data-vp-form="metas" class="vp-form vp-grade">${Object.entries(d.cargos || {}).map(([k, nome]) => `<label><span>${esc(nome)}</span><input type="number" name="${esc(k)}" min="0" max="1000" step="1" value="${esc(d.metas?.[k] ?? 0)}" inputmode="numeric" required></label>`).join('')}
          <p class="vp-nota">No mês corrente a meta vale proporcional aos dias que já passaram.</p><div class="vp-botoes"><button type="submit" class="vp-acao">Salvar metas</button></div></form>` : '';
    return `<div class="v2p-tambem"><span class="v2p-sub">Também aqui, só para os donos:</span>${fichasHtml([['carga', 'Carga da semana'], ['pesos', 'Pesos do score'], ['metas', 'Metas por cargo']], v, 'data-v2p-ver')}</div>
      ${corpo ? `<section class="v2p-card v2p-secao" data-v2p-secao>${corpo}<div class="vp-botoes">${botao('Fechar', 'data-v2p-ver=""', 's')}</div></section>` : ''}`;
  }
  function htmlProdutividade(d) {
    const comps = d.componentes || [], eu = d.detalhe, mes = estado.mes || d.mes || hoje().slice(0, 7), nomeMes = MESES_RH[Number(mes.slice(5, 7)) - 1] || 'mês';
    const time = d.gestao ? (d.ranking || []) : eu ? [eu] : [], comScore = time.filter((p) => p.score != null);
    const como = `<button type="button" class="v2p-btn s" data-vp-ajuda aria-expanded="${estado.ajuda}">Como o score é feito</button>`;
    const conquistas = time.flatMap((p) => (p.conquistas || []).map((c) => ({ c, p })));
    let frase, numeros, acaoLinhas = [];
    if (d.gestao) {
      const ordem = [...comScore].sort((a, b) => b.score - a.score), topo = ordem[0], fim = ordem.length > 1 ? ordem[ordem.length - 1] : null;
      const comMeta = time.filter((p) => p.meta > 0), bateram = comMeta.filter((p) => (p.entregues || 0) >= p.meta).length;
      const media = comScore.length ? Math.round(comScore.reduce((s, p) => s + p.score, 0) / comScore.length) : null;
      frase = !topo ? `<b>Ainda sem dado em ${esc(nomeMes)}.</b> Quando as demandas do painel andarem, o mês de cada um aparece aqui.`
        : `<b>${esc(primeiroNome(topo.nome))} lidera ${esc(nomeMes)} com score ${topo.score}</b>${(topo.conquistas || []).length ? ` e ${plural(topo.conquistas.length, 'conquista', 'conquistas')}` : ''}.${fim && fim.score < 70 ? ` <b>${esc(primeiroNome(fim.nome))}</b> está com ${fim.score}${fim.meta ? `, ${fim.entregues ?? 0} de ${fim.meta} entregas` : ''}: vale uma conversa.` : ''}`;
      numeros = tresHtml([
        { rotulo: 'Score médio do time', valor: media ?? 'sem dado', sub: comScore.length ? `de ${plural(comScore.length, 'pessoa', 'pessoas')} com entrega no mês` : 'ninguém com entrega ainda' },
        { rotulo: 'Metas batidas', valor: comMeta.length ? `${bateram} de ${comMeta.length}` : 'sem meta', sub: 'meta de entregas do cargo no mês' },
        { rotulo: 'Conquistas do mês', valor: conquistas.length, sub: conquistas.length ? `de ${plural(new Set(conquistas.map((x) => x.p.id)).size, 'pessoa', 'pessoas')}` : 'nenhuma por enquanto' },
      ]);
      const baixo = [...comScore].filter((p) => p.score < 70).sort((a, b) => a.score - b.score).slice(0, 2), alto = topo && topo.score >= 85 && !baixo.includes(topo) ? [topo] : [];
      acaoLinhas = [...baixo, ...alto].map((p) => `<div class="v2p-lin">${pilula(p.meta ? `${p.entregues ?? 0} de ${p.meta} entregas` : `Score ${p.score}`, p.score < 70 ? 'a' : 'g')}<p><b>${esc(primeiroNome(p.nome))}</b> · ${esc(p.score < 70 ? (p.atrasadas ? plural(p.atrasadas, 'peça aberta atrasada', 'peças abertas atrasadas') : `score ${p.score}`) : `score ${p.score}, na frente do time`)}</p>${botao('Ver o mês', `data-v2p-abre="${esc(p.id)}" data-abrir="1"`, 's')}</div>`);
    } else {
      const c0 = comps[0], v0 = c0 && eu?.componentes?.[c0.id];
      frase = !eu || eu.score == null ? `<b>Ainda sem dado em ${esc(nomeMes)}.</b> Quando as demandas do painel com você andarem, o seu mês aparece aqui.`
        : `<b>O seu score de ${esc(nomeMes)} é ${eu.score}.</b> ${esc((eu.frases || []).slice(0, 2).join(' e '))}.`;
      numeros = tresHtml([
        { rotulo: 'O seu score', valor: eu?.score ?? 'sem dado', sub: 'de 0 a 100' },
        { rotulo: c0 ? c0.nome : 'Entregas no prazo', valor: v0 == null ? 'sem dado' : `${Math.round(v0 * 100)}%`, sub: esc((eu?.frases || [])[0] || 'pela data do cliente') },
        { rotulo: 'Conquistas do mês', valor: conquistas.length, sub: conquistas.length ? 'suas, neste mês' : 'nenhuma por enquanto' },
      ]);
    }
    const conqLinhas = conquistas.map(({ c, p }) => `<div class="v2p-lin">${av(p.nome)}<p><b>${esc(c.titulo)}</b> <span class="v2p-sub">· ${esc(primeiroNome(p.nome))}${c.texto ? ` · ${esc(c.texto)}` : ''}</span></p></div>`);
    const semDado = `<div class="v2p-lin v2p-lin-fim">${pilula('Sem dado')}<p class="v2p-sub"><b>Ainda sem dado neste mês.</b></p></div>`;
    return `<div class="v2p v2p-produtividade">${falaHtml('Análise e números', frase, como, 'Alex')}${numeros}
      <div class="v2p-grade v2p-grade-12">
        <div class="v2p-col">${d.gestao ? `<section class="v2p-card" aria-label="Pede ação">${cabeca('Pede ação', acaoLinhas.length ? `${plural(acaoLinhas.length, 'coisa', 'coisas')}, na ordem` : '')}${acaoLinhas.join('') || '<p class="v2p-frase">Ninguém pedindo atenção neste mês.</p>'}</section>` : ''}
          <section class="v2p-card" aria-label="Conquistas do mês">${cabeca('Conquistas do mês', conquistas.length ? `${conquistas.length} ${d.gestao ? 'no time' : 'suas'}${conquistas.length > 3 && !estado.v2.mostrar.conq ? ` · ${elo('ver todas', 'data-v2p-mostrar="conq"')}` : ''}` : '')}
            ${conqLinhas.length ? recolhe(conqLinhas, 'conq', 3).join('') : comScore.length ? '<p class="v2p-frase">As conquistas do mês aparecem aqui quando chegarem.</p>' : ''}${comScore.length ? '' : semDado}</section></div>
        <section class="v2p-card v2p-lista" data-v2p-lista aria-label="${d.gestao ? 'O mês de cada um' : 'O seu mês'}">${cabeca(d.gestao ? 'O mês de cada um' : 'O seu mês', 'score de 0 a 100')}
          ${time.length ? time.map((p) => linhaDoMes(p, comps, !d.gestao)).join('') : `<p class="v2p-frase">${d.gestao ? 'Ninguém na equipe ainda. Quem pode entrar no painel aparece aqui.' : 'Ainda sem dado neste mês.'}</p>`}</section>
      </div>
      <p class="v2p-sub v2p-pe">Nada para preencher: o score sai do prazo, do volume e do ritmo de cada um nas demandas do painel.${d.fonte?.ajustes ? ` ${esc(d.fonte.ajustes)}.` : ''} Entregas e gargalos da operação ficam em Performance, na Gestão.</p>
      ${tambemProdutividade(d)}</div>`;
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
      <label><span>Assunto</span><input name="titulo" maxlength="200" required placeholder="Ex.: declaração de vínculo" value="${esc(estado.pedidoTitulo || '')}"></label>
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
    let html = `<div class="vp-linha-topo"><h3 class="vp-titulo">${d.gestao ? 'Pedidos ao RH' : 'Seus pedidos ao RH'}</h3></div>`;
    if (todos.length || d.gestao) html += kpisPedidos(d);
    if (f) {
      const lista = todos.filter(f[1]);
      html += `<p class="vp-nota">Mostrando: <b>${esc(f[0])}</b> (${lista.length}) · <button type="button" class="vp-link" data-vp-filtro-pedidos="">Mostrar todos</button></p>`;
      return html + (lista.length ? `<ul class="vp-lista">${lista.map((p) => linhaPedido(p, d)).join('')}</ul>` : vazio(f[3], ''));
    }
    const abertos = todos.filter((p) => p.sla !== 'encerrado');
    html += todos.length ? `<ul class="vp-lista">${[...abertos, ...todos.filter((p) => p.sla === 'encerrado').slice(0, 10)].map((p) => linhaPedido(p, d)).join('')}</ul>`
      : vazio('Nenhum pedido por aqui', 'Precisa de uma declaração, de férias, de um reembolso ou de algo do RH? Use "Nova solicitação", no alto, e acompanhe o prazo.');
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
    return `<small class="vp-vs ${vs.delta > 0 ? 'bom' : 'ruim'}">${vs.delta > 0 ? '▲' : '▼'} ${esc(plural(Math.abs(vs.delta), 'ponto', 'pontos'))} vs anterior</small>`;
  }
  const SITUACAO_PESQUISA = { aberta: ['Aberta', 'u6'], agendada: ['Agendada', 'u4'], encerrada: ['Encerrada', 'u5'] };
  function resultadoPesquisa(p, c) {
    const r = p.resultado || {}, de = `${br(p.abre)} a ${br(p.fecha)}`;
    let html = `<div class="vp-cartao"><div class="vp-linha-topo"><div><span class="vp-kicker">Resultado · ${esc(de)}</span><h3>${esc(p.titulo)}</h3></div>${chip(SITUACAO_PESQUISA[p.situacao] || SITUACAO_PESQUISA.encerrada)}</div>`;
    if (!r.liberado) return html + `<p class="vp-nota">${esc(plural(r.respostas || 0, 'resposta', 'respostas'))}${c.equipe ? ` de ${esc(plural(c.equipe, 'pessoa', 'pessoas'))}` : ''}. O resultado aparece com ${esc(r.minimo || c.minimo || 3)} ou mais, para ninguém ser identificado.</p></div>`;
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
    if (d.rhPronto === false) html += `<p class="vp-nota">A pesquisa de clima com período ainda não foi ligada. Os donos já sabem o que falta.</p>`;
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
  // Calendário do time pelo quadro: mês em grade de 7, cada dia com a pílula de quem (verde = férias ou folga aprovada,
  // rosa = aniversário, tracejada = pedido de férias que ainda espera resposta) e, ao lado, as listas dos próximos.
  const TOM_CAL = { aniv: 'an', ferias: 'g', pend: 'pd' };
  const FALA_CAL = { aniv: (n) => `aniversário de ${n}`, ferias: (n) => `${n} de férias ou folga`, pend: (n) => `${n} pediu férias ou folga e espera resposta` };
  const pedidosAbertos = (d) => (d.pedidos || []).filter((p) => p.sla !== 'encerrado');
  function htmlCalendario(d) {
    const h = d.hoje || hoje(), ym = /^\d{4}-\d{2}$/.test(estado.calMes) ? estado.calMes : h.slice(0, 7), [ano, mes] = ym.split('-').map(Number);
    const pend = pedidosAbertos(d).filter((p) => p.tipo === 'ferias' && p.inicio).map((p) => ({ nome: p.pessoa_nome || d.eu?.nome || 'Você', inicio: p.inicio, fim: p.fim || p.inicio }));
    const por = eventosDoMes(ym, d.aniversarios, d.ferias), porPend = eventosDoMes(ym, [], pend);
    const n = diasNoMes(ano, mes), vazios = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay(), nomeMes = MESES_RH[mes - 1], celulas = [];
    const mini = (e) => pilula(iniciais(e.nome), `mi ${TOM_CAL[e.tipo]}`, `title="${esc(maiuscula(FALA_CAL[e.tipo](e.nome)))}"`);
    for (let i = 0; i < vazios; i++) celulas.push('<span class="v2p-dia fora" aria-hidden="true"></span>');
    for (let dia = 1; dia <= n; dia++) {
      const iso = `${ym}-${String(dia).padStart(2, '0')}`, evs = [...(por[iso] || []), ...(porPend[iso] || []).map((e) => ({ ...e, tipo: 'pend' }))];
      const fala = evs.map((e) => FALA_CAL[e.tipo](e.nome)).join('; ');
      celulas.push(`<span class="v2p-dia${iso === h ? ' hoje' : ''}" role="listitem" aria-label="${esc(`${dia} de ${nomeMes}${iso === h ? ', hoje' : ''}${fala ? ': ' + fala : ''}`)}"><b aria-hidden="true">${dia}</b>`
        + (evs.length ? `<span class="v2p-dia-evs" aria-hidden="true">${mini(evs[0])}${evs.length > 1 ? pilula('+' + (evs.length - 1), 'mi n', `title="${esc(evs.slice(1).map((e) => maiuscula(FALA_CAL[e.tipo](e.nome))).join('; '))}"`) : ''}</span>` : '') + '</span>');
    }
    const curto = (iso) => (iso.slice(0, 7) === h.slice(0, 7) ? String(Number(iso.slice(8, 10))) : br(iso));
    // Próximos aniversários: o dia da semana em que cai a próxima vez.
    const aniv = proximosAniversarios(d.aniversarios).map((a) => {
      const [m, dd] = a.dia.split('-').map(Number), anoDele = a.dia >= h.slice(5) ? Number(h.slice(0, 4)) : Number(h.slice(0, 4)) + 1;
      const w = new Date(Date.UTC(anoDele, m - 1, dd)).getUTCDay();
      return `<p class="v2p-leg">${pilula(iniciais(a.nome), 'mi an')}<span><b>${esc(primeiroNome(a.nome))}</b> · ${NOME_DIA[w]}, ${m === Number(h.slice(5, 7)) ? dd : `${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}`}</span></p>`;
    });
    const meu = d.meuPerfil?.nascimento || '';
    const ferias = (d.ferias || []).filter((f) => (f.fim || f.inicio) >= h).map((f) => `<p class="v2p-leg">${pilula(iniciais(f.nome), 'mi g')}<span><b>${esc(primeiroNome(f.nome))}</b> · ${f.inicio === f.fim || !f.fim ? `folga dia ${curto(f.inicio)}` : `férias ${curto(f.inicio)} a ${curto(f.fim)}`}</span></p>`);
    const passadas = (d.ferias || []).filter((f) => (f.fim || f.inicio) < h).map((f) => `<p class="v2p-leg">${pilula(iniciais(f.nome), 'mi n')}<span><b>${esc(primeiroNome(f.nome))}</b> · ${f.inicio === f.fim || !f.fim ? br(f.inicio) : `${br(f.inicio)} a ${br(f.fim)}`}</span></p>`);
    const seta = (dd) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${dd}"/></svg>`;
    return `<section class="v2p-card v2p-calcard" aria-label="Calendário do time">
      <div class="v2p-cab v2p-cab-meio"><h3>Calendário do time</h3>${ym === h.slice(0, 7) ? '' : botao('Este mês', 'data-vp-cal="0"', 's')}
        <span class="v2p-mes" role="group" aria-label="Mês"><button type="button" data-vp-cal="-1" aria-label="Mês anterior" title="Mês anterior">${seta('M15 6l-6 6 6 6')}</button><b aria-live="polite">${esc(maiuscula(nomeMes))} de ${ano}</b><button type="button" data-vp-cal="1" aria-label="Próximo mês" title="Próximo mês">${seta('M9 6l6 6-6 6')}</button></span></div>
      <div class="v2p-cal-duas">
        <div class="v2p-cal" role="list" aria-label="${esc(`Calendário do time, ${nomeMes} de ${ano}`)}">${SEMANA_RH.map((s) => `<span class="v2p-ds" aria-hidden="true">${s}</span>`).join('')}${celulas.join('')}</div>
        <div class="v2p-cal-lado">
          <p class="v2p-sub v2p-leg-t"><b>Próximos aniversários</b></p>
          ${aniv.length ? recolhe(aniv, 'aniv', 3).join('') + restoHtml(aniv.length - 3, 'aniv', aniv.length - 3 === 1 ? 'aniversário' : 'aniversários') : '<p class="v2p-sub">Ninguém cadastrou o aniversário ainda.</p>'}
          <p class="v2p-sub v2p-meu">O seu: ${elo(/^\d{4}-\d{2}-\d{2}/.test(meu) ? `${meu.slice(8, 10)}/${meu.slice(5, 7)} · alterar` : 'cadastrar dia e mês', 'data-v2p-mostrar="meuAniv"')}</p>
          ${estado.v2.mostrar.meuAniv ? `<form data-vp-form="meu-aniversario" class="vp-form vp-inline v2p-meu-form">${campoAniversario(meu, 'Seu aniversário')}<button type="submit" class="v2p-btn s k">Salvar</button></form>` : ''}
          <p class="v2p-sub v2p-leg-t"><b>Férias e folgas aprovadas</b></p>
          ${ferias.length ? recolhe(ferias, 'ferias', 3).join('') + restoHtml(ferias.length - 3, 'ferias', 'no calendário') : '<p class="v2p-sub">Nenhuma férias ou folga marcada para os próximos dias.</p>'}
          ${passadas.length ? (estado.v2.mostrar.passadas ? passadas.join('') : restoHtml(passadas.length, 'passadas', passadas.length === 1 ? 'que já passou' : 'que já passaram')) : ''}
          ${pend.length ? `<p class="v2p-leg v2p-leg-fim">${[...new Set(pend.map((p) => p.nome))].slice(0, 4).map((nome) => pilula(iniciais(nome), 'mi pd', `title="${esc(nome)}"`)).join('')}<span class="v2p-sub">${pend.length === 1 ? 'espera' : 'esperam'} resposta</span></p>` : ''}
        </div>
      </div></section>`;
  }
  // Aniversário só com dia e mês (os seletores do painel). O ano já guardado, se houver, segue escondido e não muda.
  function campoAniversario(iso, rotulo) {
    const ok = /^\d{4}-\d{2}-\d{2}/.test(iso || ''), ano = ok ? iso.slice(0, 4) : '', mes = ok ? Number(iso.slice(5, 7)) : 0, dia = ok ? Number(iso.slice(8, 10)) : 0;
    return `<fieldset class="vp-aniv"><legend>${esc(rotulo)}</legend><input type="hidden" name="nasc_ano" value="${esc(ano)}">
      <div class="vp-aniv-campos">${escolha({ rotulo: 'Dia', valor: dia ? String(dia) : '', vazio: '—', campo: 'name="nasc_dia"', grade: 7, opcoes: Array.from({ length: 31 }, (_, i) => ({ valor: String(i + 1), nome: String(i + 1) })) })}
      ${escolha({ rotulo: 'Mês', valor: mes ? String(mes) : '', vazio: '—', campo: 'name="nasc_mes"', opcoes: MESES_RH.map((m, i) => ({ valor: String(i + 1), nome: maiuscula(m) })) })}</div></fieldset>`;
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

  // Baralho de decisão (quadro "Pedidos e calendário"): um pedido por vez na frente, os próximos atrás; decidir tira o
  // da frente pela esquerda. Para quem pediu, o baralho mostra os próprios pedidos que ainda esperam o RH.
  const posDaCarta = (k, i) => (k < i ? 'fora' : k - i <= 2 ? String(k - i) : null);
  function cartaPedido(p, d, pos) {
    const h = d.hoje || hoje(), nome = primeiroNome(p.pessoa_nome) || 'quem pediu';
    const datas = p.inicio ? (p.inicio === p.fim || !p.fim ? `dia ${br(p.inicio)}` : `${br(p.inicio)} a ${br(p.fim)}`) : p.data_desejada ? `para ${br(p.data_desejada)}` : '';
    const selo = p.sla === 'atrasado' ? pilula('Fora do prazo' + (p.atrasoUteis ? ' há ' + plural(p.atrasoUteis, 'dia útil', 'dias úteis') : ''), 'r')
      : p.prazo ? pilula(`${d.gestao ? 'Responder' : 'Resposta'} até ${dataFalada(p.prazo, h)}`, entre(h, p.prazo) <= 1 ? 'a' : 'b') : pilula('Sem prazo');
    const efeito = !d.gestao ? 'O RH responde por aqui e a resposta aparece neste pedido.'
      : p.tipo === 'ferias' ? `Aprovando, entra no calendário do time e ${nome} vê a resposta.` : `Resolvendo, ${nome} vê a resposta no pedido.`;
    return `<article class="v2-carta v2p-carta"${pos == null ? '' : ` data-pos="${pos}"`} data-carta="${esc(p.id)}">
      <p class="v2p-quemp">${av(d.gestao ? p.pessoa_nome : d.eu?.nome || p.pessoa_nome)}<b>${esc(d.gestao ? nome : 'O seu pedido')}</b>${selo}</p>
      <p class="v2p-tit">${esc(p.titulo)}</p>
      <p class="v2p-sub v2p-tit-sub">${esc([nomeTipo(d, p.tipo), datas, ha(p.idadeDias), p.status === 'andamento' ? 'em andamento' : ''].filter(Boolean).join(' · '))}</p>
      ${p.descricao ? `<p class="v2p-prova">“${esc(p.descricao)}”</p>` : ''}
      <p class="v2p-sub v2p-efeito">${esc(efeito)}</p></article>`;
  }
  function decideHtml(d) {
    const lista = pedidosAbertos(d), i = Math.min(estado.v2.carta, Math.max(0, lista.length - 1)), p = lista[i];
    if (!p) return '';
    let botoes;
    if (!d.gestao) botoes = p.status === 'aberto' ? botao('Cancelar pedido', `data-vp-pedido="${esc(p.id)}" data-status="cancelado"`) : '<span class="v2p-sub">O RH já está cuidando deste pedido.</span>';
    else if (estado.v2.recusando === p.id) botoes = `<form data-vp-form="responder" data-id="${esc(p.id)}" class="v2p-recusa"><input name="resposta" maxlength="2000" required placeholder="Motivo da recusa, para quem pediu" aria-label="Motivo da recusa">
        ${botao('Voltar', 'data-v2p-recusar=""')}<button type="submit" class="v2p-btn k" name="status" value="recusado">Recusar</button></form>`;
    else botoes = `${botao('Recusar', `data-v2p-recusar="${esc(p.id)}"`)}<button type="button" class="v2p-btn k v2-estado v2p-aprovar" data-v2p-decidir="${esc(p.id)}" data-feito="${p.tipo === 'ferias' ? 'Aprovado' : 'Resolvido'}">${p.tipo === 'ferias' ? 'Aprovar' : 'Resolver'}</button>`;
    return `<div class="v2p-decide-botoes">${botoes}</div>
      <div class="v2p-decide-pe"><span class="v2-pontos v2p-pontos">${lista.slice(0, 9).map((x, k) => `<button type="button" class="v2p-ponto${k === i ? ' on' : ''}" data-v2p-carta="${k}" aria-label="Pedido ${k + 1} de ${lista.length}"${k === i ? ' aria-current="true"' : ''}><i></i></button>`).join('')}</span>
      <span class="v2p-sub">${i + 1} de ${lista.length} · seta para os lados passa · ${elo('ver em lista', 'data-v2p-ver="lista"')}</span></div>`;
  }
  function moverBaralho(k) {
    const d = estado.dados.rh, lista = d ? pedidosAbertos(d) : [];
    if (!lista.length) return;
    estado.v2.carta = Math.max(0, Math.min(lista.length - 1, k)); estado.v2.recusando = '';
    const j = estado.janela;
    [...(j?.querySelectorAll?.('.v2p-carta') || [])].forEach((c, n) => { const pos = posDaCarta(n, estado.v2.carta); if (pos == null) c.removeAttribute('data-pos'); else c.setAttribute('data-pos', pos); });
    const alvo = j?.querySelector?.('[data-v2p-decide]');
    if (alvo) alvo.innerHTML = decideHtml(d); else pintar();
  }
  // Aprovar (ou resolver) pelo baralho: o botão gira, fica verde e o cartão sai; se o servidor recusar, tudo volta.
  async function decidir(b) {
    const id = b.dataset.v2pDecidir, d = estado.dados.rh, p = (d?.pedidos || []).find((x) => String(x.id) === String(id));
    const carta = [...(estado.janela?.querySelectorAll?.('.v2p-carta') || [])].find((x) => x.dataset.carta === String(id));
    b.dataset.estado = 'indo';
    try {
      await pedir('POST', {}, { acao: 'pedido_status', id, status: 'resolvido', resposta: '' });
      b.dataset.estado = 'feito'; b.textContent = b.dataset.feito || 'Feito';
      if (carta) carta.dataset.pos = 'fora';
      if (p) { p.status = 'resolvido'; p.sla = 'encerrado'; }
      estado.aviso = 'Resposta enviada.';
      (typeof setTimeout === 'function' ? setTimeout : (f) => f())(() => { if (estado.aba === 'rh' && estado.raiz) carregar('rh'); }, 600);
    } catch (e) { delete b.dataset.estado; estado.aviso = e.message; avisar(); }
  }
  // O que saiu do alto da tela continua a um clique, na fileira "Também no RH".
  function visaoGeralHtml(d) {
    const v = d.visao, a = v.atual;
    return `<h3 class="vp-titulo">Visão geral</h3>${seletorPeriodo()}<div class="vp-kpis">
      ${kpi('Headcount', a.headcount, versus(v.vs.headcount))}${kpi('Admissões', a.admissoes, versus(v.vs.admissoes))}
      ${kpi('Desligamentos', a.desligamentos, versus(v.vs.desligamentos, { menorMelhor: true }))}
      ${kpi('Tempo médio de casa', a.tempoMedioMeses == null ? '—' : String(a.tempoMedioMeses).replace('.', ',') + ' meses', versus(v.vs.tempoMedioMeses, { unidade: ' meses' }))}</div>
      ${v.semEntrada ? `<p class="vp-nota">${plural(v.semEntrada, 'pessoa está', 'pessoas estão')} sem data de entrada: o tempo de casa não conta ${v.semEntrada === 1 ? 'ela' : 'elas'}. Preencha em Datas de RH.</p>` : ''}`;
  }
  function datasRhHtml(d) {
    return `<h3 class="vp-titulo">Datas de RH <small>entrada, saída e aniversário</small></h3>
      <form data-vp-form="perfil" class="vp-form vp-grade"><label><span>Pessoa</span><select name="pessoa_id" required data-vp-perfil-pessoa>${pessoasOpcoes(d.pessoas || [], '', 'Escolha')}</select></label>
      ${campoAniversario('', 'Aniversário')}<label><span>Entrada na Vybe</span><input type="date" name="entrada"></label><label><span>Saída</span><input type="date" name="saida"></label>
      <div class="vp-botoes"><button type="submit" class="vp-acao">Salvar datas</button></div></form>`;
  }
  function tambemRh(d) {
    const itens = [['lista', 'Pedidos em lista'], ['clima', 'Pesquisa de clima'], ...(d.gestao ? [['prazos', 'Prazos de resposta'], d.visao ? ['visao', 'Visão geral'] : null, ['datas', 'Datas de RH'], htmlFolha() ? ['folha', 'Folha'] : null] : [])].filter(Boolean);
    const v = estado.v2.ver;
    const corpo = v === 'lista' ? htmlPedidos(d) : v === 'clima' ? htmlClima(d) : !d.gestao ? '' : v === 'prazos' ? formPrazos(d) : v === 'visao' && d.visao ? visaoGeralHtml(d) : v === 'datas' ? datasRhHtml(d) : v === 'folha' ? htmlFolha() : '';
    return `<div class="v2p-tambem"><span class="v2p-sub">Também no RH:</span>${fichasHtml(itens, v, 'data-v2p-ver')}</div>
      ${corpo ? `<section class="v2p-card v2p-secao" data-v2p-secao>${corpo}<div class="vp-botoes">${botao('Fechar', 'data-v2p-ver=""', 's')}</div></section>` : ''}`;
  }
  function htmlRh(d) {
    const h = d.hoje || hoje(), abertos = pedidosAbertos(d), ind = d.indicadores || {}, c = d.pesquisa || {}, atual = c.atual;
    const primeiro = abertos.filter((p) => p.prazo).sort((a, b) => a.prazo.localeCompare(b.prazo))[0];
    const fora = ind.foraDoPrazo ?? abertos.filter((p) => p.sla === 'atrasado').length, nAbertos = ind.abertos ?? abertos.length;
    // A fala: quantos esperam, qual vence primeiro e quem sai de férias nos próximos 14 dias.
    const saida = (d.ferias || []).find((f) => f.inicio > h && entre(h, f.inicio) <= 14), fora7 = (d.ferias || []).find((f) => f.inicio <= h && (f.fim || f.inicio) >= h);
    const fraseFerias = fora7 ? ` ${esc(primeiroNome(fora7.nome))} está fora até ${br(fora7.fim || fora7.inicio)}.`
      : saida ? ` ${esc(primeiroNome(saida.nome))} ${saida.inicio === saida.fim || !saida.fim ? `folga ${dataFalada(saida.inicio, h, true)}` : `sai de férias de ${br(saida.inicio)} a ${br(saida.fim)}`}.` : '';
    const vence = primeiro ? (primeiro.sla === 'atrasado' ? 'já passou do prazo' : `vence ${dataFalada(primeiro.prazo, h, true)}`) : '';
    const frase = (!abertos.length ? `<b>${d.gestao ? 'Nenhum pedido esperando resposta.' : 'Nada seu esperando o RH.'}</b>`
      : d.gestao ? `<b>${plural(abertos.length, 'pedido espera', 'pedidos esperam')} resposta</b>${primeiro ? ` e o de ${esc(primeiroNome(primeiro.pessoa_nome))} ${vence}` : ''}.`
        : `<b>${plural(abertos.length, 'pedido seu espera', 'pedidos seus esperam')} o RH</b>${primeiro ? `, com resposta até ${dataFalada(primeiro.prazo, h)}` : ''}.`) + fraseFerias;
    const verTodos = abertos.length ? botao(abertos.length === 1 ? 'Ver o pedido' : `Ver os ${abertos.length}`, 'data-v2p-ver="lista" data-filtro="abertos"', 's') : '';
    // Três números: a fila, o que foi respondido no prazo e a pesquisa de clima.
    const noPrazo = ind.noPrazoPct == null ? null : Math.round(ind.noPrazoPct * (ind.respondidos || 0) / 100);
    const tempo = ind.tempoMedioDias == null ? '' : `tempo médio de ${decimal(ind.tempoMedioDias)} ${ind.tempoMedioDias === 1 ? 'dia útil' : 'dias úteis'}`;
    const doHist = atual && (c.historico || []).find((x) => x.id === atual.id), respostas = doHist?.resultado?.respostas;
    const responder = atual?.situacao === 'aberta' && !atual.respondeu ? ` · ${elo('responder', 'data-v2p-ver="clima" data-form="pesquisa"')}` : atual?.respondeu ? ' · você já respondeu' : '';
    const clima = atual?.situacao === 'aberta'
      ? (respostas != null && c.equipe ? { valor: `${respostas} de ${c.equipe}`, barra: respostas / c.equipe * 100, sub: `responderam · fecha ${dataFalada(atual.fecha, h, true)}${responder}` }
        : { valor: atual.respondeu ? 'Respondida' : 'Aberta', sub: `fecha ${dataFalada(atual.fecha, h, true)}${responder}` })
      : atual?.situacao === 'agendada' ? { valor: 'Agendada', sub: `abre ${dataFalada(atual.abre, h, true)} · ${elo('ver', 'data-v2p-ver="clima"')}` }
        : { valor: 'Sem pesquisa', sub: d.gestao && d.rhPronto !== false ? `nenhuma aberta · ${elo('iniciar pesquisa', 'data-v2p-ver="clima" data-form="pesquisa-abrir"')}` : `nenhuma aberta agora · ${elo('ver', 'data-v2p-ver="clima"')}` };
    const numeros = tresHtml([
      { rotulo: d.gestao ? 'Pedidos esperando resposta' : 'Seus pedidos esperando resposta', valor: nAbertos, attrs: 'data-espiar="pessoas:abertos" role="button" tabindex="0" title="Ver a lista"',
        sub: fora ? `<span class="v2p-ruim" data-espiar="pessoas:fora" role="button" tabindex="0">${fora} fora do prazo</span>` : primeiro ? `o primeiro ${vence}` : 'ninguém na fila' },
      { rotulo: 'Respondidos no prazo', valor: noPrazo == null ? 'nenhum' : `${noPrazo} de ${ind.respondidos}`, attrs: 'data-espiar="pessoas:respondidos" role="button" tabindex="0" title="Ver a lista"', sub: noPrazo == null ? 'nenhum respondido ainda' : tempo || `${ind.noPrazoPct}% no prazo` },
      { rotulo: 'Pesquisa de clima · anônima', ...clima, ...(d.gestao && (c.historico || []).length ? { attrs: 'data-espiar="pessoas:clima" role="button" tabindex="0" title="Ver as pesquisas"' } : {}) },
    ]);
    const i = Math.min(estado.v2.carta, Math.max(0, abertos.length - 1));
    const esquerda = estado.form === 'pedido' ? formPedido(d)
      : abertos.length ? `<div class="v2-baralho v2p-baralho" role="group" aria-label="${d.gestao ? 'Pedidos para decidir' : 'Seus pedidos'}">${abertos.map((p, k) => cartaPedido(p, d, posDaCarta(k, i))).join('')}</div><div class="v2p-decide" data-v2p-decide>${decideHtml(d)}</div>`
        : `<div class="v2p-card v2p-sem"><p><b>${d.gestao ? 'Nenhum pedido esperando resposta.' : 'Nenhum pedido por aqui.'}</b></p><p class="v2p-sub">${d.gestao ? 'Quando alguém pedir férias, folga, documento ou reembolso, o pedido aparece aqui para decidir.' : 'Precisa de férias, de uma declaração ou de um reembolso? Peça e acompanhe o prazo.'}</p>${botao('Nova solicitação', 'data-vp-abrir-form="pedido"', 's')}</div>`;
    // O seu pedido já respondido (o de quem está olhando, mesmo na gestão).
    const meus = (d.pedidos || []).filter((p) => ['resolvido', 'recusado'].includes(p.status) && (!d.gestao || String(p.pessoa_id) === String(d.eu?.id))).slice(0, 2);
    const meusHtml = meus.length ? meus.map((p) => `<div class="v2p-lin">${pilula(p.status === 'recusado' ? 'Recusado' : p.tipo === 'ferias' ? 'Aprovado' : 'Respondido', p.status === 'recusado' ? 'r' : 'g')}<p><b>O seu pedido</b> · ${esc(p.titulo)}${p.respondido_dia ? `, respondido em ${br(p.respondido_dia)}` : ''}${p.resposta ? `<br><span class="v2p-sub">${esc(p.resposta)}</span>` : ''}</p>${botao('Ver', 'data-v2p-ver="lista" data-filtro="respondidos"', 's')}</div>`).join('')
      : `<div class="v2p-lin">${pilula('Sem pedido')}<p class="v2p-sub"><b>${abertos.length && !d.gestao ? 'Nenhum pedido respondido ainda.' : 'Nenhum pedido seu por aqui.'}</b></p>${estado.form === 'pedido' ? '' : botao('Nova solicitação', 'data-vp-abrir-form="pedido"', 's')}</div>`;
    return `${semMigracao(d)}<div class="v2p v2p-rh">${falaHtml('Recursos Humanos', frase, verTodos)}${numeros}
      <div class="v2p-grade v2p-grade-rh">
        <div class="v2p-col v2p-col-baralho">${cabeca(d.gestao ? 'Pede ação' : 'Seus pedidos', 'férias, folga, documento e reembolso')}${esquerda}</div>
        <div class="v2p-col">${htmlCalendario(d)}<section class="v2p-card v2p-meus" aria-label="O seu pedido">${meusHtml}</section></div>
      </div>
      <p class="v2p-sub v2p-pe">${d.gestao ? 'Decidir passa para o próximo pedido; aprovado, o tracejado do calendário fica verde. ' : ''}Do aniversário, a equipe vê só o dia e o mês.</p>
      ${tambemRh(d)}</div>`;
  }

  // Mini painel dos números da fila e do clima (data-espiar="pessoas:…", desenhado por vybe-mundo.js).
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).pessoas = (resto) => {
    const d = estado.dados.rh; if (!d) return null;
    if (resto === 'clima') {
      const hist = d.pesquisa?.historico || [];
      return { titulo: 'Pesquisas de clima', cls: '', vazio: 'Nenhuma pesquisa ainda.', rodape: 'Clique para ver o resultado',
        itens: hist.map((p) => ({ id: p.id, nome: p.titulo, sub: `${br(p.abre)} a ${br(p.fecha)} · ${plural(p.resultado?.respostas || 0, 'resposta', 'respostas')}`, dir: p.resultado?.liberado ? `eNPS ${p.resultado.enps}` : 'abaixo do mínimo' })),
        clicar: (it) => { estado.pesquisaVer = it.id; estado.v2.ver = 'clima'; pintar(); } };
    }
    const f = FILTROS_PEDIDO[resto]; if (!f) return null;
    const lista = (d.pedidos || []).filter(f[1]);
    return { titulo: f[0], cls: f[2], vazio: f[3], rodape: 'Clique para filtrar a lista',
      itens: lista.map((p) => ({ id: p.id, nome: p.titulo, sub: [d.gestao ? p.pessoa_nome : '', nomeTipo(d, p.tipo), ha(p.idadeDias)].filter(Boolean).join(' · '),
        dir: p.sla === 'atrasado' ? `${plural(p.atrasoUteis || 0, 'dia útil', 'dias úteis')} fora` : p.respondido_dia ? `respondido ${br(p.respondido_dia)}` : `prazo ${br(p.prazo)}`, cls: p.sla === 'atrasado' ? 'u1' : '' })),
      clicar: () => { estado.filtroPedidos = resto; estado.form = ''; estado.v2.ver = 'lista'; pintar(); } };
  };

  // ---------- Projetos ----------
  function htmlCarga(d) {
    if (!d) return `<h3 class="vp-titulo">Carga da semana</h3>${typeof vbEstadoHtml === 'function' ? vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando a carga' }) : ''}`;
    if (d.erro) return `<h3 class="vp-titulo">Carga da semana</h3><p class="vp-nota">Não deu para ler a carga agora. ${sec('Tentar de novo', 'data-vp-carga-semana="0"')}</p>`;
    const semana = d.semana || '';
    return `<div class="vp-linha-topo"><h3 class="vp-titulo">Carga da semana <small>${br(semana)} a ${br(d.fim)} · capacidade ${esc(plural(d.capacidade, 'item', 'itens'))}</small></h3>
      <div class="vp-nav">${sec('‹', 'data-vp-carga-semana="-7" aria-label="Semana anterior"')}${sec('Hoje', 'data-vp-carga-semana="0"')}${sec('›', 'data-vp-carga-semana="7" aria-label="Próxima semana"')}</div></div>
      ${(d.carga || []).length ? `<ul class="vp-lista vp-carga">${d.carga.map((c) => `<li class="vp-item"><div class="vp-meio"><b>${esc(c.nome)}</b>
        <small>${plural(c.pecas, 'demanda', 'demandas')}${c.atrasadas ? ` · ${c.atrasadas} atrasada${c.atrasadas === 1 ? '' : 's'}` : ''}${c.etapas ? ` · ${plural(c.etapas, 'ponto', 'pontos')} de projeto` : ''}</small>
        <span class="vp-barra larga ${NIVEL[c.nivel][1]}" aria-hidden="true"><i style="width:${Math.min(100, c.pct)}%"></i></span></div>
        <div class="vp-lado">${chip(NIVEL[c.nivel])}<small>${esc(c.pct)}%</small></div></li>`).join('')}</ul>` : vazio('Ninguém na equipe ainda', '')}`;
  }
  function htmlGantt(d) {
    let l = d.linha || {};
    if (!(l.projetos || []).length) return '<p class="v2p-frase">Nenhum projeto com datas para pôr na linha do tempo.</p>';
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
    return `<form data-vp-form="projeto" class="vp-cartao vp-form v2pj-form" aria-label="${p.id ? 'Editar projeto' : 'Novo projeto'}"><input type="hidden" name="id" value="${esc(p.id || '')}">
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
  // Pelo quadro (Projetos, padrão v2): título com Cartões ou Linha do tempo, a fala do Heitor, a barra de filtro e, lado a
  // lado, os cartões dos projetos e o projeto escolhido aberto com as etapas. O Gantt e a semana ficam em "Linha do tempo".
  // O que é enviado ao servidor não muda: o formulário é o mesmo e marcar uma etapa é o mesmo "etapa_feita".
  const PONTOS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>';
  const dm = (iso) => (/^\d{4}-\d{2}-\d{2}/.test(iso || '') ? `${Number(iso.slice(8, 10))}/${iso.slice(5, 7)}` : '—');
  const corCli = (nome) => (nome && typeof corDoClienteV2 === 'function' ? corDoClienteV2(nome) : '#6B665E');
  const cliProj = (p) => `<span class="v2pj-cli" style="--c:${corCli(p.cliente)}">${esc(p.cliente || 'Projeto interno')}</span>`;
  const etapasDe = (p) => p.etapas || [];
  const vencidasDe = (p, h) => (p.status === 'concluido' ? [] : etapasDe(p).filter((e) => !e.feita && e.fim && e.fim < h).sort((a, b) => (a.fim < b.fim ? -1 : 1)));
  const proximaDe = (p) => etapasDe(p).find((e) => !e.feita) || null;
  const pessoasDe = (p) => [...new Map(etapasDe(p).filter((e) => e.responsavel && e.responsavel_nome).map((e) => [String(e.responsavel), e.responsavel_nome])).values()];
  const juntar = (l) => (l.length < 2 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`);
  const avsProj = (nomes, max = 4) => (nomes.length ? `<span class="v2p-avs">${nomes.slice(0, max).map((n) => av(n)).join('')}${nomes.length > max ? `<span class="v2p-av" aria-hidden="true">+${nomes.length - max}</span>` : ''}</span>` : '');
  const contaEtapas = (es) => (es.length ? `${es.filter((e) => e.feita).length} de ${plural(es.length, 'etapa', 'etapas')}` : 'sem etapas');
  const pctEtapas = (es) => (es.length ? Math.round(es.filter((e) => e.feita).length / es.length * 100) : 0);
  function situacaoProj(p, h) {
    if (p.status === 'concluido') return ['Concluído', 'g'];
    if (vencidasDe(p, h).length) return ['Etapa vencida', 'r'];
    if (p.fim && p.fim < h) return ['Passou do fim', 'r'];
    if (p.status === 'planejado') return ['Planejado', 'n'];
    return ['No prazo', 'g'];
  }
  // "3/11" para o que já foi, "hoje", "sáb 21/11" para o que vem e "era 10/11" para o que venceu.
  function quandoEtapa(e, h) {
    if (e.feita) return dm(e.fim);
    if (!e.fim) return 'sem data';
    if (e.fim === h) return 'hoje';
    if (e.fim < h) return `era ${dm(e.fim)}`;
    return `${SEMANA_RH[new Date(e.fim + 'T12:00:00Z').getUTCDay()]} ${dm(e.fim)}`;
  }
  function periodoProj(p) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(p.inicio || '') || !/^\d{4}-\d{2}-\d{2}/.test(p.fim || '')) return '';
    const [ai, mi, di] = p.inicio.split('-').map(Number), [af, mf, df] = p.fim.split('-').map(Number), mes = (m) => MESES_RH[m - 1];
    if (ai === af && mi === mf) return `De ${di} a ${df} de ${mes(mf)}`;
    if (ai === af) return `De ${di} de ${mes(mi)} a ${df} de ${mes(mf)}`;
    return `De ${di} de ${mes(mi)} de ${ai} a ${df} de ${mes(mf)} de ${af}`;
  }
  const projetosVisiveis = (d) => (d.projetos || []).filter((p) => p.status !== 'cancelado');
  function projetosFiltrados(d) {
    const v = estado.v2, f = v.filtro || 'abertos';
    return projetosVisiveis(d).filter((p) => (f === 'concluidos' ? p.status === 'concluido' : p.status !== 'concluido')
      && (!v.cliente || (p.cliente || '') === v.cliente) && (!v.resp || etapasDe(p).some((e) => String(e.responsavel) === v.resp)) && (!v.tipo || p.tipo === v.tipo)
      && bate(p.nome, p.cliente || '', TIPOS_PROJETO[p.tipo] || '', p.descricao || '', ...etapasDe(p).map((e) => `${e.nome} ${e.responsavel_nome || ''}`)));
  }
  // O aberto: o escolhido ou, sem escolha, o primeiro da lista; "Fechar" guarda '' e a lista ocupa a largura toda.
  function projetoAberto(d, lista) {
    if (estado.v2.proj === '') return null;
    return projetosVisiveis(d).find((p) => p.id === estado.v2.proj) || lista[0] || null;
  }
  function falaProjetos(d, ps) {
    const h = d.hoje || hoje(), abertos = ps.filter((p) => p.status !== 'concluido'), com = abertos.filter((p) => vencidasDe(p, h).length);
    const em7 = somarDias(h, 7), vencendo = abertos.flatMap((p) => etapasDe(p).filter((e) => !e.feita && e.fim && e.fim >= h && e.fim <= em7)).length;
    let frase, extra = '';
    if (!abertos.length) frase = '<b>Nenhum projeto andando agora.</b> Os que terminaram ficam em “Concluídos”.';
    else {
      const andando = `<b><span class="v2-num">${plural(abertos.length, 'projeto', 'projetos')}</span></b> fora do mensal ${abertos.length === 1 ? 'está andando' : 'estão andando'}.`;
      if (!com.length) frase = `${andando} Nenhum tem etapa vencida${vencendo ? `; ${plural(vencendo, 'etapa vence', 'etapas vencem')} nos próximos 7 dias` : ''}.`;
      else {
        const pior = com.map((p) => ({ p, e: vencidasDe(p, h)[0] })).sort((a, b) => (a.e.fim < b.e.fim ? -1 : 1))[0];
        const dias = entre(pior.e.fim, h), desde = dias === 1 ? 'desde ontem' : `há ${dias} dias`;
        frase = com.length === 1 ? `${andando} Só o projeto ${esc(pior.p.nome)}${pior.p.cliente ? ` (${esc(pior.p.cliente)})` : ''} tem <b>etapa vencida</b>, ${desde}.`
          : `${andando} <b>${com.length} têm etapa vencida</b>; a mais antiga é ${esc(pior.e.nome)}, do projeto ${esc(pior.p.nome)}, ${desde}.`;
        extra = botao('Ver a etapa', `data-v2pj-abre="${esc(pior.p.id)}" data-forcar="1"`, 's');
      }
    }
    return falaHtml('Coordenação de produção', frase, extra, 'Heitor');
  }
  function barraProjetos(d, ps) {
    const v = estado.v2, ab = ps.filter((p) => p.status !== 'concluido').length, painel = v.painel || '';
    const clientes = [...new Set(ps.map((p) => p.cliente).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const pessoas = [...new Map(ps.flatMap(etapasDe).filter((e) => e.responsavel).map((e) => [String(e.responsavel), e.responsavel_nome || 'Sem nome'])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    const nomeResp = v.resp ? primeiroNome((pessoas.find(([id]) => id === v.resp) || [])[1] || '') : '';
    const abre = (k, rot, val) => `<button type="button" class="v2p-chip" data-v2pj-painel="${k}" aria-pressed="${Boolean(val) || painel === k}" aria-expanded="${painel === k}">${esc(val ? `${rot}: ${val}` : rot)}</button>`;
    const escolhas = (campo, lista) => lista.map(([val, rot]) => `<button type="button" class="v2p-chip" data-v2pj-campo="${campo}" data-valor="${esc(val)}" aria-pressed="${v[campo] === val}">${esc(rot)}</button>`).join('');
    const mais = painel === 'cliente' ? ['Cliente:', escolhas('cliente', clientes.map((c) => [c, c]))]
      : painel === 'resp' ? ['Responsável por etapa:', escolhas('resp', pessoas)]
        : painel === 'tipo' ? ['Tipo:', escolhas('tipo', Object.entries(TIPOS_PROJETO).filter(([k]) => ps.some((p) => p.tipo === k)))] : null;
    return `<div class="v2p-barra-f">${buscaHtml('Buscar projeto')}${fichasHtml([['abertos', 'Em andamento', ab], ['concluidos', 'Concluídos', ps.length - ab]], v.filtro || 'abertos')}
        ${clientes.length ? abre('cliente', 'Cliente', v.cliente) : ''}${pessoas.length ? abre('resp', 'Responsável', nomeResp) : ''}
        <button type="button" class="v2p-btn s" data-v2pj-painel="tipo" aria-pressed="${Boolean(v.tipo) || painel === 'tipo'}" aria-expanded="${painel === 'tipo'}">${v.tipo ? `Tipo: ${esc(TIPOS_PROJETO[v.tipo] || v.tipo)}` : 'Filtros'}</button></div>
      ${mais ? `<div class="v2p-barra-f v2p-barra-mais v2-chegou"><span class="v2p-sub">${mais[0]}</span>${mais[1] || '<span class="v2p-sub">nada para escolher</span>'}</div>` : ''}`;
  }
  function cartaoProj(p, d, on) {
    const h = d.hoje || hoje(), es = etapasDe(p), [sit, tom] = situacaoProj(p, h), venc = vencidasDe(p, h)[0], prox = venc || proximaDe(p), cor = corCli(p.cliente);
    const pe = prox ? `<span class="v2p-sub v2pj-prox${venc ? ' ruim' : ''}">${esc(prox.nome)} · ${esc(quandoEtapa(prox, h))}</span>`
      : `<span class="v2p-sub v2pj-prox">${es.length ? 'Todas as etapas feitas' : 'Sem etapas ainda'}</span>`;
    return `<button type="button" class="v2p-card v2pj-card" data-v2pj-abre="${esc(p.id)}" aria-pressed="${on}" style="--c:${cor}">
      <span class="v2pj-topo">${cliProj(p)}${pilula(sit, tom)}</span><b class="v2pj-tit">${esc(p.nome)}</b>
      <span class="v2pj-prog"><span class="v2-barra"><i style="--v:${pctEtapas(es)}%;--c:${cor}"></i></span><span class="v2p-sub">${contaEtapas(es)}</span></span>
      <span class="v2pj-pe">${avsProj(pessoasDe(p), 3)}${pe}</span></button>`;
  }
  function listaProjetos(d) {
    const lista = projetosFiltrados(d), form = estado.form === 'projeto', aberto = form ? null : projetoAberto(d, lista);
    const mostra = recolhe(lista, 'proj', aberto || form ? 3 : 6), resto = lista.slice(mostra.length), cls = [...new Set(resto.map((p) => p.cliente || ''))];
    const de = cls.length > 1 ? `de ${plural(cls.length, 'cliente', 'clientes')}` : cls[0] ? `do cliente ${cliProj(resto[0])}` : 'interno';
    return `<div class="v2pj-lista" data-v2p-lista role="group" aria-label="Projetos">${mostra.map((p) => cartaoProj(p, d, aberto?.id === p.id)).join('') || '<p class="v2p-card v2p-frase">Nenhum projeto neste filtro.</p>'}
      ${resto.length ? `<p class="v2p-sub v2pj-resto">+ ${plural(resto.length, 'projeto', 'projetos')} ${de} · ${elo('mostrar', 'data-v2p-mostrar="proj"')}</p>` : ''}</div>`;
  }
  function paginaProj(p, d) {
    const h = d.hoje || hoje(), es = etapasDe(p), pct = pctEtapas(es), [sit, tom] = situacaoProj(p, h), cor = corCli(p.cliente), prox = proximaDe(p), nomes = pessoasDe(p);
    const pode = (e) => Boolean(d.gestao || (e.responsavel && String(e.responsavel) === String(d.eu?.id)));
    const linhas = es.map((e) => {
      const ok = Boolean(e.feita), venc = !ok && e.fim && e.fim < h, eh = prox && e.id === prox.id;
      const nome = `<span class="v2-risca${ok ? ' feita' : ''}">${esc(e.nome)}</span>`;
      return `<div class="v2p-lin v2pj-etapa"><button type="button" class="v2p-cx${ok ? ' ok' : ''}" data-v2pj-etapa="${esc(e.id)}" aria-pressed="${ok}" aria-label="${ok ? 'Reabrir' : 'Marcar como feita'}: ${esc(e.nome)}"${pode(e) ? '' : ' disabled title="Só quem cuida da etapa ou da gestão marca"'}>${CHECK}</button>
        <p>${eh ? `<b>${nome}</b> ${pilula(venc ? 'vencida' : 'próxima', venc ? 'r' : 'b')}` : nome + (venc ? ` ${pilula('vencida', 'r')}` : '')}</p>
        <span class="v2p-sub v2pj-quando${venc ? ' ruim' : ''}">${esc(quandoEtapa(e, h))}</span>${e.responsavel_nome ? av(e.responsavel_nome) : '<span class="v2p-av" aria-hidden="true">?</span>'}</div>`;
    }).join('');
    // As etapas que viraram demanda na esteira (projeto com cliente): quantas, se alguma passou do prazo, e abre a próxima.
    const dem = es.filter((e) => e.demanda_id), venceu = (e) => !e.demanda_final && (e.demanda_prazo || e.fim) && (e.demanda_prazo || e.fim) < h;
    const atr = dem.filter(venceu).length, alvo = dem.find((e) => !e.demanda_final) || dem[0];
    const demandas = dem.length ? `<div class="v2p-lin">${pilula(plural(dem.length, 'demanda', 'demandas'))}<p>${dem.length === 1 ? 'ligada' : 'ligadas'} ao projeto · ${atr ? `<b class="v2pj-ruim">${plural(atr, 'atrasada', 'atrasadas')}</b>` : dem.length === 1 ? 'não está atrasada' : 'nenhuma atrasada'}</p>${botao('Abrir', `data-vp-demanda="${esc(alvo.demanda_id)}" title="Abrir a demanda da etapa ${esc(alvo.nome)}"`, 's')}</div>` : '';
    const mais = estado.v2.mais === p.id;
    return `<section class="v2p-card v2pj-pag${estado.v2.vira ? ' v2pj-vira' : ''}" data-v2pj-pag aria-label="Projeto ${esc(p.nome)}">
      <div class="v2pj-pag-topo">${cliProj(p)}${pilula(sit, tom)}${pilula(TIPOS_PROJETO[p.tipo] || 'Outro')}<span class="v2pj-esp"></span>
        ${d.gestao ? botao('Editar', `data-vp-editar-projeto="${esc(p.id)}"`, 's') : ''}
        <span class="v2pj-mais"><button type="button" class="v2p-btn s" data-v2pj-mais="${esc(p.id)}" aria-expanded="${mais}" aria-label="Mais opções">${PONTOS}</button>
          ${mais ? `<span class="v2pj-menu v2-pop" role="menu"><button type="button" role="menuitem" data-v2pj-tempo="${esc(p.id)}">Ver na linha do tempo</button></span>` : ''}</span>
        ${botao('Fechar', 'data-v2pj-abre=""', 's')}</div>
      <h3 class="v2pj-pag-tit">${esc(p.nome)}</h3>
      <p class="v2p-sub v2pj-quem">${esc([periodoProj(p), nomes.length ? `com ${juntar(nomes.map(primeiroNome))}` : ''].filter(Boolean).join(' · '))}</p>
      ${p.descricao ? `<p class="v2p-sub v2pj-desc">${esc(p.descricao)}</p>` : ''}
      <div class="v2pj-prog v2pj-prog-g"><span class="v2-barra"><i style="--v:${pct}%;--c:${cor}"></i></span><b>${pct}%</b><span class="v2p-sub">${contaEtapas(es)}</span></div>
      <div class="v2pj-etapas">${linhas || '<p class="v2p-frase">Nenhuma etapa ainda.</p>'}${demandas}</div>
      <div class="v2pj-rodape">${avsProj(nomes)}<p class="v2p-sub">${nomes.length ? `${plural(nomes.length, 'pessoa', 'pessoas')} nas etapas` : 'Ninguém nas etapas ainda'}</p>
        ${d.gestao ? botao('Nova etapa', `data-v2pj-nova-etapa="${esc(p.id)}"`, 's') : ''}
        ${prox && pode(prox) ? `<button type="button" class="v2p-btn s v2-estado" data-v2pj-concluir="${esc(prox.id)}" title="Marca como feita: ${esc(prox.nome)}">Concluir etapa</button>` : ''}</div></section>`;
  }
  // Linha do tempo: o Gantt (um projeto ou todos, com zoom) e as etapas de cada dia da semana (todos ou só as minhas).
  function tempoProjetos(d, ps) {
    const hj = d.hoje || hoje(), zoom = estado.projZoom || 'semana';
    const seg = (rot, lista, atual, attr) => `<span class="v2pj-seg" role="group" aria-label="${rot}">${lista.map(([k, r]) => `<button type="button" ${attr}="${k}" aria-pressed="${atual === k}">${r}</button>`).join('')}</span>`;
    const gantt = `<section class="v2p-card v2pj-tempo" aria-label="Linha do tempo dos projetos"><div class="v2p-cab v2pj-cab"><h3>Linha do tempo</h3>
        <div class="v2pj-ctl"><label class="vp-sr-pai"><span class="vp-sr">Projeto</span><select class="v2pj-sel" data-vp-proj-sel><option value="">Todos os projetos</option>${ps.map((p) => `<option value="${esc(p.id)}"${p.id === estado.projSel ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        ${seg('Zoom', [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']], zoom, 'data-vp-proj-zoom')}</div></div>${htmlGantt(d)}</section>`;
    const ini = d.semana || hj, dias = Array.from({ length: 7 }, (_, i) => somarDias(ini, i));
    const eu = d.eu?.id || (d.pessoas || []).find((x) => String(x.nome || '').split(' ')[0].toLowerCase() === String((typeof operadorDoTopo === 'function' ? (operadorDoTopo()?.name || operadorDoTopo()?.nome) : '') || '').split(' ')[0].toLowerCase())?.id;
    const meus = estado.projFiltro === 'meus';
    const etapasDia = (dia) => ps.flatMap((p) => etapasDe(p).filter((e) => e.inicio && e.fim && e.inicio <= dia && e.fim >= dia && (!meus || String(e.responsavel) === String(eu))).map((e) => ({ e, p })));
    const semana = `<section class="v2p-card v2pj-tempo" aria-label="A semana"><div class="v2p-cab v2pj-cab"><h3>A semana</h3><small>${br(ini)} a ${br(somarDias(ini, 6))}</small>
        <div class="v2pj-ctl">${seg('De quem', [['todos', 'Todos'], ['meus', 'Meus projetos']], estado.projFiltro || 'todos', 'data-vp-proj-filtro')}
        <div class="vp-nav">${sec('‹', 'data-vp-semana="-7" aria-label="Semana anterior"')}${sec('Hoje', 'data-vp-semana="0"')}${sec('›', 'data-vp-semana="7" aria-label="Próxima semana"')}</div></div></div>
      <div class="vp-semana7">${dias.map((dia) => { const l = etapasDia(dia); return `<div class="vp-dia${dia === hj ? ' hoje' : ''}"><small>${SEMANA_RH[new Date(dia + 'T12:00:00Z').getUTCDay()]}</small><b>${br(dia).slice(0, 5)}</b>
        ${l.length ? l.map(({ e, p }) => `<span class="vp-etapa-dia${e.feita ? ' feita' : e.fim < hj ? ' atrasada' : ''}" title="${esc(p.nome)} · ${esc(e.responsavel_nome || 'sem responsável')}"><b>${esc(e.nome)}</b><small>${esc(p.nome)}</small></span>`).join('') : '<span class="vp-dia-vazio">—</span>'}</div>`; }).join('')}</div></section>`;
    return gantt + semana;
  }
  function htmlProjetos(d) {
    const ps = projetosVisiveis(d), form = estado.form === 'projeto';
    // Sem nenhum projeto: só a fala com o que é a tela; "Novo projeto" fica no alto para quem cria.
    if (!ps.length) {
      const texto = 'Evento, lançamento ou site fora do mensal: crie o projeto com as etapas e veja tudo na linha do tempo.' + (d.gestao ? '' : ' Quem cuida da gestão cria os projetos.');
      return `${semMigracao(d)}<div class="v2p v2p-proj">${falaHtml('Coordenação de produção', `<b>Nenhum projeto pontual.</b> ${esc(texto)}`, '', 'Heitor')}${form ? formProjeto(d) : ''}</div>`;
    }
    if (estado.v2.vista === 'tempo') return `${semMigracao(d)}<div class="v2p v2p-proj">${falaProjetos(d, ps)}${form ? formProjeto(d) : ''}${tempoProjetos(d, ps)}</div>`;
    const aberto = form ? null : projetoAberto(d, projetosFiltrados(d)), lado = form ? formProjeto(d) : aberto ? paginaProj(aberto, d) : '';
    return `${semMigracao(d)}<div class="v2p v2p-proj">${falaProjetos(d, ps)}${barraProjetos(d, ps)}
      <div class="v2pj-grade${lado ? '' : ' so-lista'}">${listaProjetos(d)}${lado}</div></div>`;
  }
  // Escolher um projeto: o cartão fica marcado e a página dele abre ao lado. `forcar` (da fala) limpa os filtros.
  function abrirProjeto(id, forcar = false) {
    if (forcar) Object.assign(estado.v2, { filtro: '', busca: '', cliente: '', resp: '', tipo: '', painel: '', vista: 'cartoes' });
    Object.assign(estado.v2, { proj: id, mais: '', vira: Boolean(id) });
    if (estado.form === 'projeto') { estado.form = ''; estado.editar = null; }
    pintar(); estado.v2.vira = false;
    if (id) estado.janela?.querySelector?.('[data-v2pj-pag]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  function marcarEtapa(b) {
    if (b.disabled) return;
    const feita = b.getAttribute('aria-pressed') !== 'true';
    b.classList?.toggle('ok', feita); b.setAttribute?.('aria-pressed', String(feita));
    b.parentElement?.querySelector?.('.v2-risca')?.classList?.toggle('feita', feita);
    gravar({ acao: 'etapa_feita', id: b.dataset.v2pjEtapa, feita }, feita ? 'Etapa feita.' : 'Etapa reaberta.');
  }
  // "Concluir etapa": o botão gira, fica verde e a etapa é riscada; se o servidor recusar, tudo volta.
  async function concluirEtapa(b) {
    const id = b.dataset.v2pjConcluir, caixa = [...(estado.janela?.querySelectorAll?.('[data-v2pj-etapa]') || [])].find((x) => x.dataset.v2pjEtapa === id);
    b.dataset.estado = 'indo';
    try {
      await pedir('POST', {}, { acao: 'etapa_feita', id, feita: true });
      b.dataset.estado = 'feito'; b.textContent = 'Concluída';
      if (caixa) { caixa.classList?.add('ok'); caixa.setAttribute?.('aria-pressed', 'true'); caixa.parentElement?.querySelector?.('.v2-risca')?.classList?.add('feita'); }
      estado.aviso = 'Etapa feita.'; avisar();
      (typeof setTimeout === 'function' ? setTimeout : (f) => f())(() => { if (estado.aba === 'projetos' && estado.raiz) carregar('projetos'); }, 700);
    } catch (e) { delete b.dataset.estado; estado.aviso = e.message; avisar(); }
  }
  // "Nova etapa": abre o mesmo formulário de editar, com uma etapa em branco no fim.
  function novaEtapa(id, d) {
    const p = (d.projetos || []).find((x) => x.id === id); if (!p) return;
    const ultimo = etapasDe(p).map((e) => e.fim).filter(Boolean).sort().pop(), ini = ultimo && ultimo > hoje() ? ultimo : hoje();
    abrirForm('projeto', { ...p, etapas: [...etapasDe(p), { inicio: ini, fim: somarDias(ini, 3) }] });
    const nomes = estado.janela?.querySelectorAll?.('[data-vp-form="projeto"] [name="e_nome"]');
    nomes?.[nomes.length - 1]?.focus?.();
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
  const contaAulas = (aulas) => { const docs = (aulas || []).filter((a) => a.tipo === 'doc').length; return { videos: (aulas || []).length - docs, docs }; };
  const aulasTexto = (aulas) => { const { videos, docs } = contaAulas(aulas); return [videos ? plural(videos, 'vídeo', 'vídeos') : '', docs ? plural(docs, 'documento', 'documentos') : ''].filter(Boolean).join(' · ') || 'sem aulas ainda'; };
  const progressoDe = (t) => t.progresso || { pct: 0, concluidas: 0, total: (t.aulas || []).length };
  // As trilhas da tela: as do servidor (a minha primeiro) ou, antes da ativação, o modelo só para ver.
  function trilhasDaTela(d) {
    const lista = [...(d.trilhas || [])].sort((a, b) => Number(b.minha) - Number(a.minha));
    if (lista.length || !d.modelo) return lista;
    return [{ ...d.modelo, id: 'modelo', modelo: true, aulas: d.modelo.aulas.map((a, i) => ({ ...a, id: 'm' + i })) }];
  }
  function trilhasFiltradas(d) {
    const f = estado.v2.filtro || 'ar', t2 = estado.v2.tipo;
    return trilhasDaTela(d).filter((t) => { const pr = progressoDe(t);
      return (f !== 'minhas' || t.minha) && (!t2 || (t2 === 'andamento' ? pr.pct > 0 && pr.pct < 100 : t2 === 'feitas' ? pr.total > 0 && pr.pct >= 100 : pr.pct === 0))
        && bate(t.nome, t.descricao || '', ...(t.aulas || []).map((a) => a.titulo)); });
  }
  function detalheTrilha(t, d) {
    const feitas = new Set((d.feitas || []).map(String)), aulas = t.aulas || [];
    const lista = aulas.map((a, i) => { const ok = feitas.has(String(a.id)), nome = `${i + 1} · ${esc(a.titulo)}`;
      return `<p class="v2p-aula"><button type="button" class="v2p-cx${ok ? ' ok' : ''}" data-v2p-aula="${esc(a.id || '')}" aria-pressed="${ok}" aria-label="${ok ? 'Desmarcar' : 'Marcar como feita'}: ${esc(a.titulo)}"${t.modelo ? ' disabled' : ''}>${CHECK}</button>
        ${a.link ? `<a class="v2p-aula-nome${ok ? ' feita' : ''}" href="${esc(a.link)}" target="_blank" rel="noopener noreferrer" title="Abrir ${a.tipo === 'doc' ? 'o documento' : 'o vídeo'}">${nome}</a>` : `<span class="v2p-aula-nome${ok ? ' feita' : ''}" title="Link a definir">${nome}</span>`}
        <small>${a.tipo === 'doc' ? 'doc' : 'vídeo'} · ${esc(a.minutos)} min${a.link ? '' : ' · sem link'}</small></p>`; }).join('');
    const gestao = d.gestao && !t.modelo ? `<div class="v2p-det-acoes">${botao('Editar trilha', `data-vp-editar-trilha="${esc(t.id)}"`, 's')}
        <details class="vp-det v2p-atribuir"><summary class="v2p-btn s">Atribuir e acompanhar</summary>
        <form data-vp-form="atribuir" class="vp-form vp-inline"><input type="hidden" name="trilha_id" value="${esc(t.id)}"><label><span>Pessoa</span><select name="pessoa_id" required>${pessoasOpcoes(d.pessoas, '', 'Escolha')}</select></label>
        <label><span>Prazo</span><input type="date" name="prazo"></label><button type="submit" class="vp-acao">Atribuir</button></form>
        ${(t.atribuidas || []).length ? `<ul class="vp-simples">${t.atribuidas.map((a) => `<li><b>${esc(a.progresso.pct)}%</b> ${esc(a.nome)}${a.prazo ? ` · até ${br(a.prazo)}` : ''}</li>`).join('')}</ul>` : '<p class="vp-nota">Ninguém com esta trilha ainda.</p>'}</details></div>` : '';
    return `<div class="v2p-det">${t.descricao ? `<p class="v2p-sub">${esc(t.descricao)}</p>` : ''}${aulas.length ? `<div class="v2p-aulas" style="--linhas:${Math.ceil(aulas.length / 2)}">${lista}</div>` : '<p class="v2p-sub">Esta trilha ainda não tem aulas.</p>'}${gestao}</div>`;
  }
  function listaAcademy(d) {
    const todas = trilhasDaTela(d), lista = trilhasFiltradas(d);
    const linhas = lista.map((t) => { const pr = progressoDe(t), at = t.atribuidas || [], fim = at.filter((a) => a.progresso?.pct >= 100).length;
      const doTime = d.gestao && !t.modelo, pct = doTime ? (at.length ? fim / at.length * 100 : 0) : pr.pct;
      const texto = doTime ? (at.length ? `${fim} de ${at.length} ${fim === 1 ? 'terminou' : 'terminaram'}` : 'ninguém atribuído') : `${pr.concluidas} de ${plural(pr.total, 'aula', 'aulas')}`;
      return linhaAbre(t.id, `<b>${esc(t.nome)}</b><br><span class="v2p-sub">${esc(aulasTexto(t.aulas))}${t.minha ? ' · atribuída a você' : t.modelo ? ' · modelo' : ''}</span>`,
        `<div class="v2-barra v2p-barra-lin"><i style="--v:${Math.round(pct)}%;--c:${pct >= 60 ? '#11613A' : '#9A5B00'}"></i></div><span class="v2p-conta">${esc(texto)}</span>`, detalheTrilha(t, d), `a trilha ${t.nome}`); }).join('');
    const vazioHtml = `<div class="v2p-lin v2p-lin-fim">${pilula('Sem trilha')}<p class="v2p-sub"><b>Nenhuma trilha ainda.</b>${d.gestao ? ' Monte a primeira com os vídeos e documentos que todo mundo que chega precisa ver.' : ''}</p>${d.gestao ? acao('Montar a primeira trilha', 'data-vp-trilha-modelo') : ''}</div>${d.gestao ? '' : '<p class="vp-nota">Quem monta as trilhas são os donos e o RH: peça a eles a sua.</p>'}`;
    return `<section class="v2p-card v2p-lista" data-v2p-lista aria-label="Trilhas">${cabeca(estado.v2.filtro === 'minhas' ? 'Minhas trilhas' : 'Trilhas no ar', d.gestao ? 'quantos do time já terminaram' : 'o seu avanço em cada uma')}
      ${linhas || (todas.length ? '<p class="v2p-frase">Nenhuma trilha neste filtro.</p>' : estado.form === 'trilha' ? '' : vazioHtml)}</section>`;
  }
  function htmlAcademy(d) {
    const h = d.hoje || hoje(), todas = trilhasDaTela(d), reais = todas.filter((t) => !t.modelo), feitas = new Set((d.feitas || []).map(String));
    const minha = todas.find((t) => t.minha && progressoDe(t).pct < 100) || todas.find((t) => t.minha), prM = minha ? progressoDe(minha) : null;
    const proxima = minha ? (minha.aulas || []).findIndex((a) => !feitas.has(String(a.id))) : -1, faltam = prM ? prM.total - prM.concluidas : 0;
    const total = contaAulas(todas.flatMap((t) => t.aulas || []));
    // Gestão: quem recebeu trilha e ainda não terminou, da mais urgente (prazo vencido) para a menos.
    const pendentes = d.gestao ? reais.flatMap((t) => (t.atribuidas || []).filter((a) => (a.progresso?.pct || 0) < 100).map((a) => ({ a, t, atraso: a.prazo && a.prazo < h ? entre(a.prazo, h) : 0 })))
      .sort((x, y) => y.atraso - x.atraso || (x.a.progresso?.pct || 0) - (y.a.progresso?.pct || 0)) : [];
    const principal = d.gestao ? [...reais].sort((x, y) => (y.atribuidas || []).length - (x.atribuidas || []).length)[0] : null;
    const atP = principal?.atribuidas || [], fimP = atP.filter((a) => a.progresso?.pct >= 100).length, faltamP = atP.length - fimP;
    let frase, extra = '';
    if (!todas.length) frase = `<b>Nenhuma trilha ainda.</b> ${d.gestao ? 'Monte a primeira com os vídeos e documentos que todo mundo que chega precisa ver.' : 'Quando os donos montarem uma trilha, ela aparece aqui.'}`;
    else if (d.gestao && reais.length) {
      frase = `<b>${plural(reais.length, 'trilha no ar', 'trilhas no ar')}.</b> ${!atP.length ? 'Ninguém recebeu trilha ainda: abra uma e atribua.' : faltamP ? `${plural(faltamP, 'pessoa ainda não terminou', 'pessoas ainda não terminaram')} a ${esc(principal.nome)}.` : `Quem recebeu a ${esc(principal.nome)} já terminou.`}`;
      if (faltamP) extra = botao(faltamP === 1 ? 'Ver quem falta' : `Ver as ${faltamP}`, `data-v2p-abre="${esc(principal.id)}" data-abrir="1"`, 's');
    } else if (minha && faltam) { frase = `<b>${plural(faltam, 'aula falta', 'aulas faltam')}</b> para você terminar a ${esc(minha.nome)}.`; extra = botao('Continuar', `data-v2p-abre="${esc(minha.id)}" data-abrir="1"`, 's'); }
    else frase = `<b>${plural(todas.length, 'trilha no ar', 'trilhas no ar')}.</b> ${minha ? 'Você terminou a sua.' : 'Nenhuma atribuída a você ainda.'}`;
    const minhasAulas = todas.filter((t) => t.minha).map(progressoDe);
    const numeros = tresHtml([
      { rotulo: 'Trilhas no ar', valor: todas.length, sub: todas.length ? `${plural(total.videos, 'vídeo', 'vídeos')} e ${plural(total.docs, 'documento', 'documentos')}` : 'nenhuma montada' },
      d.gestao ? { rotulo: principal && atP.length ? `Terminaram a ${principal.nome}` : 'Terminaram a trilha', valor: atP.length ? `${fimP} de ${atP.length}` : 'ninguém', sub: atP.length ? 'de quem recebeu a trilha' : 'ninguém com trilha atribuída' }
        : { rotulo: 'Aulas feitas', valor: minhasAulas.length ? `${minhasAulas.reduce((s, p) => s + p.concluidas, 0)} de ${minhasAulas.reduce((s, p) => s + p.total, 0)}` : 'nenhuma', sub: minhasAulas.length ? 'somando as suas trilhas' : 'sem trilha atribuída' },
      { rotulo: 'A sua trilha', valor: prM ? `${prM.pct}%` : 'nenhuma', sub: !minha ? 'nenhuma atribuída a você' : faltam ? `${faltam === 1 ? 'falta 1 aula' : `faltam ${faltam} aulas`} · ${elo('continuar', `data-v2p-abre="${esc(minha.id)}" data-abrir="1"`)}` : 'concluída' },
    ]);
    const meu = (k) => { const pr = todas.filter((t) => { const p = progressoDe(t); return k === 'andamento' ? p.pct > 0 && p.pct < 100 : k === 'feitas' ? p.total > 0 && p.pct >= 100 : p.pct === 0; }); return pr.length; };
    const barra = `<div class="v2p-barra-f">${buscaHtml('Buscar trilha, vídeo ou documento')}${fichasHtml([['ar', 'No ar', todas.length], ['minhas', 'Minhas', todas.filter((t) => t.minha).length]], estado.v2.filtro || 'ar')}
      <button type="button" class="v2p-btn s" data-v2p-filtros aria-pressed="${estado.v2.filtros}">Filtros</button></div>
      ${estado.v2.filtros ? `<div class="v2p-barra-f v2p-barra-mais"><span class="v2p-sub">O seu avanço:</span>${fichasHtml([['andamento', 'Em andamento', meu('andamento')], ['feitas', 'Terminei', meu('feitas')], ['zero', 'Não comecei', meu('zero')]], estado.v2.tipo, 'data-v2p-tipo')}</div>` : ''}`;
    const acaoLinhas = d.gestao ? pendentes.map(({ a, t, atraso }) => { const pr = a.progresso || { pct: 0, concluidas: 0, total: 0 };
      return `<div class="v2p-lin">${atraso ? pilula(`Atrasada há ${plural(atraso, 'dia', 'dias')}`, 'r') : pr.pct ? pilula('Em andamento', 'b') : pilula('Não começou', 'a')}<p><b>${esc(primeiroNome(a.nome))}</b> · ${esc(t.nome)}<br><span class="v2p-sub">${pr.pct ? `parou na aula ${pr.concluidas} de ${pr.total}` : 'ainda não abriu'}${a.prazo ? ` · prazo ${br(a.prazo)}` : ''}</span></p>${botao('Abrir', `data-v2p-abre="${esc(t.id)}" data-abrir="1"`, 's')}</div>`; })
      : todas.filter((t) => t.minha && progressoDe(t).pct < 100).map((t) => { const pr = progressoDe(t);
        return `<div class="v2p-lin">${pilula(pr.pct ? 'Em andamento' : 'Não começou', pr.pct ? 'b' : 'a')}<p><b>${esc(t.nome)}</b><br><span class="v2p-sub">${pr.concluidas} de ${plural(pr.total, 'aula', 'aulas')}</span></p>${botao('Continuar', `data-v2p-abre="${esc(t.id)}" data-abrir="1"`, 's')}</div>`; });
    const aula = proxima >= 0 ? minha.aulas[proxima] : null;
    const suaTrilha = `<section class="v2p-card v2p-sua" aria-label="A sua trilha">${cabeca('A sua trilha', minha ? `${esc(minha.nome)} · ${prM.concluidas} de ${plural(prM.total, 'aula', 'aulas')}` : '')}
      ${!minha ? '<p class="v2p-frase">Nenhuma trilha atribuída a você.</p>' : !aula ? '<p class="v2p-frase">Você terminou esta trilha.</p>'
        : `<div class="v2p-lin"><span class="v2p-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></span><p><b>${aula.tipo === 'doc' ? 'Documento' : 'Vídeo'} ${proxima + 1} · ${esc(aula.titulo)}</b><br><span class="v2p-sub">${esc(plural(Number(aula.minutos) || 0, 'minuto', 'minutos'))} · ${faltam > 1 ? `depois ${faltam - 1 === 1 ? 'falta 1 aula' : `faltam ${faltam - 1} aulas`}` : 'é a última'}</span></p>
          ${aula.link ? `<a class="v2p-btn s k" href="${esc(aula.link)}" target="_blank" rel="noopener noreferrer">Continuar</a>` : botao('Continuar', `data-v2p-abre="${esc(minha.id)}" data-abrir="1"`, 's k')}</div>`}
      ${minha ? `<div class="v2-barra"><i style="--v:${prM.pct}%;--c:#FF7A2F"></i></div>` : ''}</section>`;
    return `${semMigracao(d)}<div class="v2p v2p-academy">${falaHtml('Treinamento', frase, extra)}${numeros}${barra}${estado.form === 'trilha' ? formTrilha() : ''}
      <div class="v2p-grade v2p-grade-13">
        <div class="v2p-col"><section class="v2p-card" aria-label="Pede ação">${cabeca('Pede ação', acaoLinhas.length ? `${plural(acaoLinhas.length, 'coisa', 'coisas')}, na ordem` : '')}
          ${acaoLinhas.length ? recolhe(acaoLinhas, 'acao', 3).join('') + restoHtml(acaoLinhas.length - 3, 'acao', 'na fila') : '<p class="v2p-frase">Nada pendente nas trilhas.</p>'}</section>${suaTrilha}</div>
        ${listaAcademy(d)}
      </div>
      <p class="v2p-sub v2p-pe">Quem monta as trilhas são os donos e o RH.${d.gestao ? ' A trilha abre no lugar com as aulas; marque a aula quando terminar.' : ' Precisa de uma? Use “Pedir uma trilha”, no alto.'}</p></div>`;
  }

  // ---------- Recrutamento ----------
  const TOM_ETAPA = ['n', 'a', 'b', 'g'], COR_ETAPA = ['#4A463F', '#9A5B00', '#3B5BA9', '#11613A'];
  const DIAS_RETORNO = 5;
  function contaRecrutamento(d) {
    const h = d.hoje || hoje(), etapas = d.etapas || [], vagas = d.vagas || [], abertasIds = new Set(vagas.filter((v) => v.status === 'aberta').map((v) => v.id));
    const final = (e) => /^(aprovad|contratad|reprovad)/i.test(e || '') || (etapas.length > 1 && e === etapas[etapas.length - 1]);
    const idade = (c) => (c.criado_em ? Math.max(0, entre(c.criado_em, h)) : 0);
    // Sem retorno: em vaga aberta, fora das etapas finais e há mais de 5 dias no funil (o painel guarda a entrada, não a troca de etapa).
    const pendentes = (d.candidatos || []).filter((c) => abertasIds.has(c.vaga_id) && !final(c.etapa) && idade(c) > DIAS_RETORNO).sort((a, b) => idade(b) - idade(a));
    return { h, etapas, vagas, abertasIds, idade, pendentes, pendIds: new Set(pendentes.map((c) => c.id)) };
  }
  const tomEtapa = (e, i) => (/^reprovad/i.test(e) ? 'r' : TOM_ETAPA[i % 4]);
  function moverHtml(c, etapas) {
    return `<label class="v2p-btn s v2p-mover"><span aria-hidden="true">Mover de etapa</span><span class="vp-sr">Mover ${esc(c.nome)} para</span><select data-vp-mover="${esc(c.id)}">${etapas.map((x) => `<option${x === c.etapa ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>`;
  }
  function listaRecrutamento(d) {
    const { h, etapas, vagas, pendIds } = contaRecrutamento(d), f = estado.v2.filtro || 'abertas', cands = d.candidatos || [];
    const daVaga = (v) => cands.filter((c) => c.vaga_id === v.id);
    const lista = vagas.filter((v) => (f === 'fechadas' ? v.status !== 'aberta' : v.status === 'aberta') && (f !== 'pendente' || daVaga(v).some((c) => pendIds.has(c.id)))
      && (!estado.vaga || v.id === estado.vaga) && bate(v.titulo, v.cargo || '', ...daVaga(v).map((c) => c.nome)));
    const fechadas = vagas.filter((v) => v.status !== 'aberta').length;
    const linhas = lista.map((v) => { const cs = daVaga(v), comGente = etapas.map((e, i) => [e, i, cs.filter((c) => c.etapa === e)]).filter(([, , l]) => l.length);
      const ha2 = v.aberta_em ? `aberta há ${plural(Math.max(0, entre(v.aberta_em, h)), 'dia', 'dias')}` : '';
      const sub = [v.status === 'aberta' ? ha2 : v.status === 'pausada' ? 'pausada' : `fechada${v.fechada_em ? ' em ' + br(v.fechada_em) : ''}`, v.cargo || ''].filter(Boolean).join(' · ');
      const detalhe = `<div class="v2p-det">${comGente.length ? `<div class="v2p-etp">${comGente.map(([e, , l]) => `<div><p class="v2p-sub">${esc(e)}${l.some((c) => pendIds.has(c.id)) ? ' · sem retorno' : ''}</p><span class="v2p-avs">${l.map((c) => `<button type="button" class="v2p-av${pendIds.has(c.id) ? ' at' : ''}" data-vp-editar-candidato="${esc(c.id)}" title="${esc(c.nome)}: abrir e mover de etapa" aria-label="${esc(c.nome)}, em ${esc(e)}: abrir">${esc(iniciais(c.nome))}</button>`).join('')}</span></div>`).join('')}</div>` : '<p class="v2p-sub">Nenhum candidato nesta vaga ainda.</p>'}
        ${v.descricao ? `<p class="v2p-sub">${esc(v.descricao)}</p>` : ''}
        <div class="v2p-det-acoes">${botao('Novo candidato', `data-vp-abrir-form="candidato" data-vaga="${esc(v.id)}"`, 's')}${botao('Editar vaga', `data-vp-editar-vaga="${esc(v.id)}"`, 's')}</div></div>`;
      return linhaAbre(v.id, `<b>${esc(v.titulo)}</b> <span class="v2p-sub">· ${plural(cs.length, 'candidato', 'candidatos')}</span><br><span class="v2p-sub">${esc(sub)}</span>`,
        `<span class="v2p-pills">${comGente.map(([e, i, l]) => pilula(`${e} ${l.length}`, tomEtapa(e, i))).join('')}</span>`, detalhe, `a vaga ${v.titulo}`); }).join('');
    const titulo = f === 'fechadas' ? 'Vagas fechadas' : f === 'pendente' ? 'Com retorno pendente' : 'Vagas abertas';
    const semVaga = `<div class="v2p-lin v2p-lin-fim">${pilula('Sem vaga')}<p class="v2p-sub"><b>Nenhuma vaga aberta.</b></p>${estado.form === 'vaga' ? '' : botao('Nova vaga', 'data-vp-abrir-form="vaga"', 's')}</div>`;
    return `<section class="v2p-card v2p-lista" data-v2p-lista aria-label="${titulo}">${cabeca(titulo, 'etapa sem candidato não aparece')}
      ${linhas || (vagas.some((v) => v.status === 'aberta') || f === 'fechadas' ? `<p class="v2p-frase">${f === 'fechadas' ? 'Nenhuma vaga fechada.' : 'Nenhuma vaga neste filtro.'}</p>` : '')}
      ${f !== 'fechadas' && fechadas ? `<p class="v2p-sub v2p-resto">+ ${plural(fechadas, 'vaga fechada recolhida', 'vagas fechadas recolhidas')} · ${elo('mostrar', 'data-v2p-filtro="fechadas"')}</p>` : ''}
      ${vagas.some((v) => v.status === 'aberta') ? '' : semVaga}</section>`;
  }
  function htmlRecrutamento(d) {
    if (d.proibido) return vazio('Recrutamento é dos donos', 'Esta aba é só para os donos e quem administra.');
    const ind = d.indicadores || {}, R = contaRecrutamento(d), { h, etapas, vagas, pendentes } = R, todos = d.candidatos || [];
    const abertas = vagas.filter((v) => v.status === 'aberta'), fechadas = vagas.length - abertas.length, nomeVaga = Object.fromEntries(vagas.map((v) => [v.id, v.titulo]));
    const nCand = (id) => todos.filter((c) => c.vaga_id === id).length, noFunil = todos.filter((c) => R.abertasIds.has(c.vaga_id) && (!estado.vaga || c.vaga_id === estado.vaga));
    const anual = estado.periodo === 'anual', ref = estado.ref || h.slice(0, 7), corte = anual ? ref.slice(0, 4) : ref;
    const entraram = todos.filter((c) => diaIso(c.criado_em).startsWith(corte)).length;
    const antiga = abertas.map((v) => v.aberta_em).filter(Boolean).sort()[0];
    const frase = !vagas.length ? '<b>Nenhuma vaga aberta.</b> Abra a primeira para começar a receber candidatos no funil.'
      : `<b>${plural(ind.abertas ?? abertas.length, 'vaga aberta', 'vagas abertas')}, ${plural(ind.candidatos ?? todos.length, 'candidato', 'candidatos')}.</b> ${pendentes.length ? `${plural(pendentes.length, 'espera', 'esperam')} retorno há mais de ${DIAS_RETORNO} dias${pendentes[0] ? `, a começar por ${esc(primeiroNome(pendentes[0].nome))} (${esc(nomeVaga[pendentes[0].vaga_id] || '')})` : ''}.` : 'Ninguém parado no funil há mais de 5 dias.'}`;
    const tm = ind.tempoMedio || {}, vs = versus(ind.vs, { menorMelhor: true, unidade: ' dias' }).replace(/<(\/?)small/g, '<$1span');
    const numeros = tresHtml([
      { rotulo: 'Vagas abertas', valor: ind.abertas ?? abertas.length, sub: antiga ? `a mais antiga há ${plural(Math.max(0, entre(antiga, h)), 'dia', 'dias')}` : fechadas ? `${plural(fechadas, 'fechada', 'fechadas')}` : 'nenhuma por enquanto' },
      { rotulo: 'Candidatos', valor: ind.candidatos ?? todos.length, sub: `${plural(entraram, 'entrou', 'entraram')} ${anual ? 'neste ano' : ref === h.slice(0, 7) ? 'neste mês' : 'no mês escolhido'}` },
      { rotulo: 'Tempo médio de contratação', valor: tm.dias == null ? 'sem dado' : plural(tm.dias, 'dia', 'dias'), sub: `${tm.contratacoes ? plural(tm.contratacoes, 'contratação', 'contratações') : 'ninguém contratado'} no período · ${vs}` },
    ]);
    const f = estado.v2.filtro || 'abertas';
    let html = `${semMigracao(d)}<div class="v2p v2p-recrutamento">${falaHtml('Recursos Humanos', frase, pendentes.length ? botao(pendentes.length === 1 ? 'Ver quem espera' : `Ver os ${pendentes.length}`, 'data-v2p-filtro="pendente"', 's') : '')}${numeros}
      <div class="v2p-barra-f">${buscaHtml('Buscar vaga ou candidato')}${fichasHtml([['abertas', 'Abertas', abertas.length], ['pendente', 'Com retorno pendente', pendentes.length], ['fechadas', 'Fechadas', fechadas]], f)}
        <button type="button" class="v2p-btn s" data-v2p-filtros aria-pressed="${estado.v2.filtros || Boolean(estado.vaga)}">Filtros</button>${botao('Etapas', 'data-vp-abrir-form="etapas"', 's')}</div>
      ${(estado.v2.filtros || estado.vaga) && vagas.length ? `<div class="v2p-barra-f v2p-barra-mais">${escolha({ rotulo: 'Vaga', valor: estado.vaga || '', vazio: 'Todas', campo: 'data-vp-vaga', opcoes: vagas.map((v) => ({ valor: v.id, nome: v.titulo + (v.status !== 'aberta' ? ` (${v.status})` : ''), n: nCand(v.id) })) })}</div>` : ''}`;
    if (estado.form === 'vaga') {
      const v = estado.editar || {};
      html += `<form data-vp-form="vaga" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(v.id || '')}"><h3 class="vp-titulo">${v.id ? 'Editar vaga' : 'Nova vaga'}</h3><div class="vp-grade">
        <label><span>Título</span><input name="titulo" maxlength="200" required value="${esc(v.titulo || '')}"></label><label><span>Cargo</span><input name="cargo" maxlength="100" value="${esc(v.cargo || '')}"></label>
        <label><span>Status</span><select name="status">${opcoes({ aberta: 'Aberta', pausada: 'Pausada', fechada: 'Fechada' }, v.status || 'aberta')}</select></label></div>
        <label><span>Descrição</span><textarea name="descricao" rows="2" maxlength="2000">${esc(v.descricao || '')}</textarea></label>
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar vaga</button></div></form>`;
    }
    if (estado.form === 'candidato') {
      const c = estado.editar || {};
      html += `<form data-vp-form="candidato" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(c.id || '')}"><h3 class="vp-titulo">${c.id ? 'Candidato' : 'Novo candidato'}</h3><div class="vp-grade">
        <label><span>Nome</span><input name="nome" maxlength="200" required value="${esc(c.nome || '')}"></label><label><span>Contato</span><input name="contato" maxlength="200" value="${esc(c.contato || '')}"></label>
        <label><span>Vaga</span><select name="vaga_id" required>${vagas.map((v) => `<option value="${esc(v.id)}"${v.id === (c.vaga_id || estado.vaga) ? ' selected' : ''}>${esc(v.titulo)}</option>`).join('')}</select></label>
        <label><span>Etapa</span><select name="etapa">${etapas.map((e) => `<option${e === (c.etapa || etapas[0]) ? ' selected' : ''}>${esc(e)}</option>`).join('')}</select></label></div>
        <label><span>Observação</span><textarea name="observacao" rows="2" maxlength="2000">${esc(c.observacao || '')}</textarea></label>
        ${c.id ? `<p class="vp-nota">No funil desde ${br(diaIso(c.criado_em))}${c.contratado_em ? ` · contratado em ${br(diaIso(c.contratado_em))}` : ''}.</p>` : ''}
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar candidato</button></div></form>`;
    }
    if (estado.form === 'etapas') html += `<form data-vp-form="etapas" class="vp-cartao vp-form"><label><span>Etapas do funil (uma por linha, na ordem)</span><textarea name="etapas" rows="5">${esc(etapas.join('\n'))}</textarea></label>
      <p class="vp-nota">A etapa chamada Aprovado (ou Contratado) conta como contratação; a última é a de saída.</p><div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar etapas</button></div></form>`;
    const maior = Math.max(1, ...etapas.map((e) => noFunil.filter((c) => c.etapa === e).length));
    const acaoLinhas = pendentes.map((c) => `<div class="v2p-lin">${pilula(plural(R.idade(c), 'dia', 'dias'), R.idade(c) > DIAS_RETORNO + 2 ? 'r' : 'a')}<p><b>${esc(c.nome)}</b> · ${esc(nomeVaga[c.vaga_id] || '')}<br><span class="v2p-sub">em ${esc(c.etapa)} · no funil desde ${br(diaIso(c.criado_em))}</span></p>${moverHtml(c, etapas)}</div>`);
    return html + `<div class="v2p-grade v2p-grade-125">
        <div class="v2p-col"><section class="v2p-card" aria-label="Pede ação">${cabeca('Pede ação', pendentes.length ? `${plural(pendentes.length, 'coisa', 'coisas')}, na ordem` : '')}
            ${acaoLinhas.length ? recolhe(acaoLinhas, 'acao', 3).join('') + restoHtml(acaoLinhas.length - 3, 'acao', 'esperando retorno') : '<p class="v2p-frase">Ninguém esperando retorno.</p>'}</section>
          <section class="v2p-card v2p-funil" aria-label="Funil">${cabeca(`Funil de ${MESES_RH[Number(h.slice(5, 7)) - 1]}`, `${plural(noFunil.length, 'candidato', 'candidatos')} ${estado.vaga ? 'nesta vaga' : abertas.length === 1 ? 'na vaga aberta' : `nas ${abertas.length} vagas`}`)}
            ${noFunil.length ? '' : '<p class="v2p-frase">Nenhum candidato no funil.</p>'}${etapas.map((e, i) => { const n = noFunil.filter((c) => c.etapa === e).length; return !n ? '' : `<div class="v2p-fun"><span>${esc(e)}</span><div class="v2-barra"><i style="--v:${Math.round(n / maior * 100)}%;--c:${/^reprovad/i.test(e) ? '#B42318' : COR_ETAPA[i % 4]}"></i></div><b>${n}</b></div>`; }).join('')}</section></div>
        ${listaRecrutamento(d)}
      </div>
      <p class="v2p-sub v2p-pe">A vaga abre no lugar com os candidatos em cada etapa. O candidato muda de etapa na própria linha.</p></div>`;
  }

  // ---------- Documentos ----------
  const SELO_DOC = { vencido: (x) => [`Venceu em ${br(x.renovacao)}`, 'r'], renovar: (x) => [`Vence em ${br(x.renovacao)}`, 'a'], em_dia: (x) => [`Em dia até ${br(x.renovacao)}`, 'g'], sem_renovacao: () => ['Sem validade', 'n'], encerrado: () => ['Encerrado', 'n'] };
  const seloDoc = (x) => pilula(...(SELO_DOC[x.situacao] || SELO_DOC.sem_renovacao)(x));
  function listaDocumentos(d) {
    const f = estado.v2.filtro || 'todos', t2 = estado.v2.tipo, docs = d.documentos || [];
    const passa = (x) => (t2 === 'encerrado' ? x.situacao === 'encerrado' : x.situacao !== 'encerrado' && (!t2 || x.tipo === t2))
      && (f === 'todos' || (f === 'renovar' ? x.situacao === 'renovar' : f === 'vencidos' ? x.situacao === 'vencido' : x.situacao === 'sem_renovacao'))
      && bate(x.titulo, x.pessoa_nome || '', (d.tipos || {})[x.tipo] || '');
    const por = new Map();
    for (const x of docs.filter(passa)) { const k = String(x.pessoa_id ?? x.pessoa_nome); if (!por.has(k)) por.set(k, { id: k, nome: x.pessoa_nome || 'Sem nome', docs: [] }); por.get(k).docs.push(x); }
    const peso = (g) => (g.docs.some((x) => x.situacao === 'vencido') ? 0 : g.docs.some((x) => x.situacao === 'renovar') ? 1 : 2);
    const primeira = (g) => g.docs.filter((x) => ['vencido', 'renovar'].includes(x.situacao)).map((x) => x.renovacao).sort()[0] || '';
    const grupos = [...por.values()].sort((a, b) => peso(a) - peso(b) || primeira(a).localeCompare(primeira(b)) || a.nome.localeCompare(b.nome, 'pt-BR'));
    // Com alguém pedindo atenção, quem está com tudo em dia fica recolhido (a um clique).
    const recolher = f === 'todos' && !t2 && !estado.v2.busca.trim() && !estado.v2.mostrar.emDia && grupos.some((g) => peso(g) < 2);
    const visiveis = recolher ? grupos.filter((g) => peso(g) < 2) : grupos, emDia = grupos.length - visiveis.length;
    const linhas = visiveis.map((g) => { const v = g.docs.filter((x) => x.situacao === 'vencido'), r = g.docs.filter((x) => x.situacao === 'renovar');
      const selo = v.length ? pilula(v.length === 1 ? `1 venceu em ${br(v[0].renovacao)}` : `${v.length} vencidos`, 'r') : r.length ? pilula(r.length === 1 ? `1 vence em ${br(r[0].renovacao)}` : `${r.length} a vencer`, 'a') : pilula('Em dia', 'g');
      const detalhe = `<div class="v2p-docs">${g.docs.map((x) => `<p class="v2p-doc"><span class="v2p-doc-nome" title="${esc([(d.tipos || {})[x.tipo] || x.tipo || '', x.inicio ? `desde ${br(x.inicio)}` : ''].filter(Boolean).join(' · '))}">${esc(x.titulo)}</span>${seloDoc(x)}
        ${x.link ? `<a class="v2p-link" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer">Abrir</a>` : ''}${elo('Editar', `data-vp-editar-documento="${esc(x.id)}"`)}</p>`).join('')}</div>`;
      return linhaAbre(g.id, `${av(g.nome)}<span><b>${esc(primeiroNome(g.nome))}</b> <span class="v2p-sub">· ${plural(g.docs.length, 'documento', 'documentos')}</span><br><span class="v2p-sub">${esc(g.docs.map((x) => x.titulo).join(', '))}</span></span>`, selo, detalhe, `os documentos de ${g.nome}`); }).join('');
    return `<section class="v2p-card v2p-lista" data-v2p-lista aria-label="Por colaborador">${cabeca('Por colaborador', 'contratos e documentos de cada um')}
      ${linhas || `<p class="v2p-frase">${docs.length ? 'Nenhum documento neste filtro.' : 'Nenhum documento cadastrado.'}</p>`}
      ${emDia ? `<p class="v2p-sub v2p-resto">+ ${plural(emDia, 'colaborador com tudo em dia recolhido', 'colaboradores com tudo em dia recolhidos')} · ${elo('mostrar', 'data-v2p-mostrar="emDia"')}</p>` : ''}</section>`;
  }
  function htmlDocumentos(d) {
    if (d.proibido) return vazio('Documentos são dos donos', 'Esta aba é só para os donos e quem administra.');
    const h = d.hoje || hoje(), docs = d.documentos || [], ativos = docs.filter((x) => x.situacao !== 'encerrado'), dias = d.avisoDias || 30;
    const venc = ativos.filter((x) => x.situacao === 'vencido').sort((a, b) => a.renovacao.localeCompare(b.renovacao)), renovar = ativos.filter((x) => x.situacao === 'renovar').sort((a, b) => a.renovacao.localeCompare(b.renovacao));
    const semVal = ativos.filter((x) => x.situacao === 'sem_renovacao').length, emDia = ativos.length - venc.length - renovar.length, pedem = [...venc, ...renovar];
    const gente = new Set(ativos.map((x) => String(x.pessoa_id ?? x.pessoa_nome))).size, encerrados = docs.length - ativos.length;
    const frase = !docs.length ? '<b>Nenhum documento cadastrado.</b> Registre contratos e documentos da equipe para ser avisado antes de vencer.'
      : pedem.length ? `<b>${[venc.length ? plural(venc.length, 'documento venceu', 'documentos venceram') : '', renovar.length ? `${plural(renovar.length, 'vence', 'vencem')} em até ${dias} dias` : ''].filter(Boolean).join(' e ')}.</b> ${emDia === 1 ? 'O outro documento do time está em dia.' : emDia ? `Os outros ${emDia} documentos do time estão em dia.` : ''}`
        : `<b>Nenhuma renovação nos próximos dias.</b> ${plural(ativos.length, 'documento do time está', 'documentos do time estão')} em dia.`;
    const numeros = tresHtml([
      { rotulo: 'Documentos do time', valor: ativos.length, barra: ativos.length ? emDia / ativos.length * 100 : 0, sub: `${emDia} em dia · de ${plural(gente, 'colaborador', 'colaboradores')}` },
      { rotulo: `Vencem em ${dias} dias`, valor: renovar.length, tom: renovar.length ? 'atencao' : '', sub: renovar.length ? `o primeiro em ${plural(Math.max(0, entre(h, renovar[0].renovacao)), 'dia', 'dias')}` : 'nenhum por enquanto' },
      { rotulo: 'Vencidos', valor: venc.length, tom: venc.length ? 'ruim' : '', sub: venc.length ? `há ${plural(Math.max(1, entre(venc[0].renovacao, h)), 'dia', 'dias')}` : 'nenhum' },
    ]);
    const tipos = Object.entries(d.tipos || {}).map(([k, nome]) => [k, nome, ativos.filter((x) => x.tipo === k).length]).filter(([, , n]) => n);
    const barra = `<div class="v2p-barra-f">${buscaHtml('Buscar colaborador ou documento')}${fichasHtml([['todos', 'Todos', ativos.length], ['renovar', 'A vencer', renovar.length], ['vencidos', 'Vencidos', venc.length], ['sem', 'Sem validade', semVal]], estado.v2.filtro || 'todos')}
      <button type="button" class="v2p-btn s" data-v2p-filtros aria-pressed="${estado.v2.filtros}">Filtros</button></div>
      ${estado.v2.filtros ? `<div class="v2p-barra-f v2p-barra-mais"><span class="v2p-sub">Tipo:</span>${fichasHtml([...tipos, ...(encerrados ? [['encerrado', 'Encerrados', encerrados]] : [])], estado.v2.tipo, 'data-v2p-tipo')}</div>` : ''}`;
    let form = '';
    if (estado.form === 'documento') {
      const x = estado.editar || {};
      form = `<form data-vp-form="documento" class="vp-cartao vp-form"><input type="hidden" name="id" value="${esc(x.id || '')}"><h3 class="vp-titulo">${x.id ? 'Editar documento' : 'Novo documento'}</h3><div class="vp-grade">
        <label><span>Colaborador</span><select name="pessoa_id" required>${pessoasOpcoes(d.pessoas, x.pessoa_id, 'Escolha')}</select></label>
        <label><span>Tipo</span><select name="tipo">${opcoes(d.tipos || {}, x.tipo || 'contrato')}</select></label>
        <label><span>Título</span><input name="titulo" maxlength="200" required value="${esc(x.titulo || '')}"></label>
        <label><span>Status</span><select name="status">${opcoes({ ativo: 'Ativo', encerrado: 'Encerrado' }, x.status || 'ativo')}</select></label>
        <label><span>Início</span><input type="date" name="inicio" value="${esc(x.inicio || '')}"></label><label><span>Renovação</span><input type="date" name="renovacao" value="${esc(x.renovacao || '')}"></label></div>
        <label><span>Link do arquivo (https://)</span><input type="url" name="link" maxlength="1000" value="${esc(x.link || '')}"></label>
        <label><span>Observação</span><textarea name="observacao" rows="2" maxlength="2000">${esc(x.observacao || '')}</textarea></label>
        <div class="vp-botoes">${sec('Cancelar', 'data-vp-fechar-form')}<button type="submit" class="vp-acao">Salvar documento</button></div></form>`;
    }
    const renovarBtn = (x) => botao('Renovar', `data-vp-editar-documento="${esc(x.id)}" data-foco="renovacao"`, 's');
    const acaoLinhas = pedem.map((x, i) => { const n = x.situacao === 'vencido' ? Math.max(1, entre(x.renovacao, h)) : Math.max(0, entre(h, x.renovacao));
      const selo = x.situacao === 'vencido' ? pilula(`Venceu há ${plural(n, 'dia', 'dias')}`, 'r') : pilula(n ? `Vence em ${plural(n, 'dia', 'dias')}` : 'Vence hoje', 'a');
      return i === 0 && x.situacao === 'vencido' ? `<div class="v2p-lin dest"><p>${selo}<br><b>${esc(x.titulo)}</b><br><span class="v2p-sub">${esc(primeiroNome(x.pessoa_nome))} · venceu em ${br(x.renovacao)}</span></p>${renovarBtn(x)}</div>`
        : `<div class="v2p-lin">${selo}<p><b>${esc(x.titulo)}</b> · ${esc(primeiroNome(x.pessoa_nome))}</p>${renovarBtn(x)}</div>`; });
    return `${semMigracao(d)}<div class="v2p v2p-documentos">${falaHtml('Recursos Humanos', frase, pedem.length ? botao(pedem.length === 1 ? 'Ver o documento' : `Ver os ${pedem.length}`, 'data-v2p-mostrar="acao"', 's') : '')}${numeros}${barra}${form}
      <div class="v2p-grade v2p-grade-115">
        <section class="v2p-card v2p-acao" aria-label="Pede ação">${cabeca('Pede ação', pedem.length ? `${plural(pedem.length, 'renovação', 'renovações')}, da mais urgente para a menos` : '')}
          ${acaoLinhas.length ? recolhe(acaoLinhas, 'acao', 4).join('') + restoHtml(acaoLinhas.length - 4, 'acao', 'para renovar') : docs.length ? '<p class="v2p-frase">Nenhuma renovação nos próximos dias.</p>' : ''}
          ${docs.length ? '' : `<div class="v2p-lin v2p-lin-fim">${pilula('Sem documento')}<p class="v2p-sub"><b>Nenhum documento cadastrado.</b></p>${estado.form === 'documento' ? '' : botao('Novo documento', 'data-vp-abrir-form="documento"', 's')}</div>`}</section>
        ${listaDocumentos(d)}
      </div>
      <p class="v2p-sub v2p-pe">O colaborador abre no lugar com os contratos e documentos dele. O aviso de renovação chega ${dias} dias antes de vencer.</p></div>`;
  }

  // ---------- desenho ----------
  const DESENHO = { produtividade: htmlProdutividade, rh: htmlRh, projetos: htmlProjetos, academy: htmlAcademy, recrutamento: htmlRecrutamento, documentos: htmlDocumentos };
  const LISTA_V2 = { academy: listaAcademy, recrutamento: listaRecrutamento, documentos: listaDocumentos, projetos: listaProjetos };
  function htmlCorpo() {
    const d = estado.dados[estado.aba];
    if (!d) return estado.erro ? vazio('Não deu para abrir agora', estado.erro, acao('Tentar de novo', 'data-vp-recarregar')) : '<p class="vp-carregando" role="status">Carregando…</p>';
    return (estado.erro ? `<p class="vp-erro">Não foi possível atualizar: ${esc(estado.erro)} <button type="button" class="vp-link" data-vp-recarregar>Tentar de novo</button></p>` : '') + DESENHO[estado.aba](d);
  }
  function htmlPainel() {
    // Aberto pelo dock, a janela mostra só as abas daquele item (opções { abas, rotulo }); com uma aba só, sem barra de abas.
    const g = gestao(), abas = ABAS.filter(([k]) => (g || !SO_GESTAO.has(k)) && (!estado.soAbas || estado.soAbas.has(k)));
    const dAba = estado.dados[estado.aba], periodo = estado.aba === 'recrutamento' && dAba && !dAba.proibido ? seletorPeriodo()
      : estado.aba === 'projetos' && dAba && projetosVisiveis(dAba).length ? `<div class="vp-periodo"><span class="vp-seg" role="group" aria-label="Como ver os projetos">${[['cartoes', 'Cartões'], ['tempo', 'Linha do tempo']].map(([k, r]) => `<button type="button" data-v2pj-vista="${k}" aria-pressed="${(estado.v2.vista || 'cartoes') === k}">${r}</button>`).join('')}</span></div>`
      : estado.aba === 'produtividade' && dAba ? `<div class="vp-periodo">${mesHtml(estado.mes || dAba.mes || hoje().slice(0, 7), 'data-vp-mes-ir') || `<label class="vp-campo-inline"><span class="vp-sr">Mês</span><input type="month" data-vp-mes value="${esc(estado.mes || dAba.mes || hoje().slice(0, 7))}" max="${esc(hoje().slice(0, 7))}"></label>`}</div>` : '';
    const botoes = `<div class="vp-topo-botoes">${acaoDoTopo(estado.dados[estado.aba])}${periodo}<button type="button" class="vp-x vb-janela-x" data-vp-ajuda aria-expanded="${estado.ajuda}" aria-label="O que é esta aba" title="O que é esta aba">?</button>
        ${botaoX('data-vp-fechar', 'vp-x')}</div>`;
    return `<div class="vp-topo vb-janela-topo">${cabecalho({ id: 'vp-titulo', titulo: estado.aba === 'projetos' ? 'Projetos' : (ABAS.find(([k]) => k === estado.aba) || ABAS[0])[1], texto: V2.has(estado.aba) ? '' : FRASE[estado.aba] || '', acoes: botoes })}</div>
      ${estado.ajuda ? `<p class="vp-ajuda" role="note">${esc(AJUDA[estado.aba])}</p>` : ''}
      <div class="vp-abas" role="tablist" aria-label="Partes do setor de Pessoas"${abas.length > 1 ? '' : ' hidden'}>${abas.map(([k, r]) => `<button type="button" role="tab" id="vp-aba-${k}" aria-controls="vp-corpo" aria-selected="${k === estado.aba}" data-vp-aba="${k}">${esc(r)}</button>`).join('')}</div>
      <p class="vp-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vp-corpo" id="vp-corpo" role="tabpanel" aria-labelledby="vp-aba-${estado.aba}" aria-busy="${estado.carregando}">${htmlCorpo()}</div>`;
  }
  function pintar() {
    const janela = estado.janela; if (!janela) return;
    const corpo = janela.querySelector?.('.vp-corpo'), rolagem = corpo?.scrollTop || 0;
    janela.className = 'vp-janela' + (V2.has(estado.aba) ? ' v2p-janela' : '');
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
    estado.aba = aba; estado.form = ''; estado.editar = null; estado.aviso = ''; estado.erro = ''; estado.filtroPedidos = ''; estado.v2 = v2Novo(); estado.pedidoTitulo = '';
    pintar(); window.VybeTutorial?.dica?.('pessoas');
    return carregar(aba);
  }
  function aoClicar(e) {
    const t = e.target, perto = (s) => t?.closest?.(s), d = estado.dados[estado.aba] || {};
    if (t === estado.raiz) { fechar(); return; }
    let b;
    if ((b = perto('[data-v2p-abre]'))) abrirLinha(b.dataset.v2pAbre, b.dataset.abrir === '1');
    else if ((b = perto('[data-v2p-carta]'))) moverBaralho(Number(b.dataset.v2pCarta));
    else if ((b = perto('[data-v2p-decidir]'))) decidir(b);
    else if ((b = perto('[data-v2p-recusar]'))) {
      estado.v2.recusando = b.dataset.v2pRecusar;
      const alvo = estado.janela?.querySelector?.('[data-v2p-decide]');
      if (alvo) { alvo.innerHTML = decideHtml(d); alvo.querySelector('input')?.focus?.(); } else pintar();
    }
    else if ((b = perto('[data-v2p-ver]'))) verNoRh(b.dataset.v2pVer, b.dataset);
    else if ((b = perto('[data-v2p-filtro]'))) { estado.v2.filtro = b.dataset.v2pFiltro; estado.v2.aberta = ''; pintar(); }
    else if ((b = perto('[data-v2p-tipo]'))) { estado.v2.tipo = estado.v2.tipo === b.dataset.v2pTipo ? '' : b.dataset.v2pTipo; pintar(); }
    else if (perto('[data-v2p-filtros]')) { estado.v2.filtros = !(estado.v2.filtros || estado.vaga); if (!estado.v2.filtros) { estado.v2.tipo = ''; estado.vaga = ''; } pintar(); }
    else if ((b = perto('[data-v2p-mostrar]'))) { const k = b.dataset.v2pMostrar; estado.v2.mostrar[k] = k === 'meuAniv' ? !estado.v2.mostrar[k] : true; pintar(); }
    else if ((b = perto('[data-v2p-aula]'))) { const feita = b.getAttribute('aria-pressed') !== 'true'; b.classList?.toggle('ok', feita); gravar({ acao: 'aula_feita', aula_id: b.dataset.v2pAula, feita }, feita ? 'Aula concluída.' : 'Aula desmarcada.'); }
    else if (perto('[data-v2p-pedir-trilha]')) pedirTrilha();
    else if ((b = perto('[data-v2pj-abre]'))) abrirProjeto(b.dataset.v2pjAbre, b.dataset.forcar === '1');
    else if ((b = perto('[data-v2pj-vista]'))) { estado.v2.vista = b.dataset.v2pjVista; estado.v2.mais = ''; pintar(); }
    else if ((b = perto('[data-v2pj-painel]'))) { const k = b.dataset.v2pjPainel; estado.v2.painel = estado.v2.painel === k ? '' : k; pintar(); }
    else if ((b = perto('[data-v2pj-campo]'))) { const k = b.dataset.v2pjCampo, v = b.dataset.valor || ''; estado.v2[k] = estado.v2[k] === v ? '' : v; pintar(); }
    else if ((b = perto('[data-v2pj-mais]'))) { estado.v2.mais = estado.v2.mais === b.dataset.v2pjMais ? '' : b.dataset.v2pjMais; pintar(); }
    else if ((b = perto('[data-v2pj-tempo]'))) { Object.assign(estado.v2, { vista: 'tempo', mais: '' }); estado.projSel = b.dataset.v2pjTempo; pintar(); }
    else if ((b = perto('[data-v2pj-etapa]'))) marcarEtapa(b);
    else if ((b = perto('[data-v2pj-concluir]'))) concluirEtapa(b);
    else if ((b = perto('[data-v2pj-nova-etapa]'))) novaEtapa(b.dataset.v2pjNovaEtapa, d);
    else if (perto('[data-vp-fechar]')) fechar();
    else if (perto('[data-vp-ajuda]')) { estado.ajuda = !estado.ajuda; pintar(); }
    else if ((b = perto('[data-vp-aba]'))) trocarAba(b.dataset.vpAba);
    else if (perto('[data-vp-recarregar]')) carregar();
    else if ((b = perto('[data-vp-proj-zoom]'))) { estado.projZoom = b.dataset.vpProjZoom; pintar(); }
    else if ((b = perto('[data-vp-proj-filtro]'))) { estado.projFiltro = b.dataset.vpProjFiltro; pintar(); }
    else if ((b = perto('[data-vp-abrir-form]'))) abrirForm(b.dataset.vpAbrirForm, b.dataset.vpAbrirForm === 'projeto' ? { inicio: hoje(), fim: somarDias(hoje(), 14), etapas: [{}] } : b.dataset.vpAbrirForm === 'trilha' ? { aulas: [{}] } : b.dataset.vpAbrirForm === 'candidato' && b.dataset.vaga ? { vaga_id: b.dataset.vaga } : null);
    else if (perto('[data-vp-fechar-form]')) { estado.form = ''; estado.editar = null; pintar(); }
    else if ((b = perto('[data-vp-pessoa]'))) { estado.pessoa = b.dataset.vpPessoa; carregar(); }
    else if ((b = perto('[data-vp-periodo]'))) { estado.periodo = b.dataset.vpPeriodo; carregar(); }
    else if ((b = perto('[data-vp-ref-ir]'))) { estado.ref = b.dataset.vpRefIr; carregar(); }
    else if ((b = perto('[data-vp-mes-ir]'))) { estado.mes = b.dataset.vpMesIr; carregar(); }
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
    else if ((b = perto('[data-vp-editar-documento]'))) { abrirForm('documento', (d.documentos || []).find((x) => x.id === b.dataset.vpEditarDocumento)); if (b.dataset.foco) estado.janela?.querySelector?.(`[data-vp-form="documento"] [name="${b.dataset.foco}"]`)?.focus?.(); }
    else if (perto('[data-vp-nova-etapa]')) acrescentar('[data-vp-etapas]', linhaEtapa({ inicio: hoje(), fim: somarDias(hoje(), 3) }, d.pessoas));
    else if (perto('[data-vp-trilha-modelo]')) { const m = window.VybePessoasCalculos?.TRILHA_PADRAO; abrirForm('trilha', m ? { nome: m.nome, descricao: m.descricao, aulas: m.aulas.map((x) => ({ ...x })) } : { aulas: [{}] }); }
    else if (perto('[data-vp-nova-aula]')) acrescentar('[data-vp-aulas]', linhaAula({}, estado.janela.querySelectorAll('.vp-aula-form').length));
    else if ((b = perto('[data-vp-remover-linha]'))) b.parentElement?.remove?.();
  }
  // Linha que abre no lugar: troca só o atributo, para a abertura animar. `forcar` (vindo da fala ou de "Pede ação")
  // abre mesmo que um filtro esteja escondendo a linha.
  function abrirLinha(id, forcar = false) {
    estado.v2.aberta = !forcar && estado.v2.aberta === String(id) ? '' : String(id);
    const linhas = () => [...(estado.janela?.querySelectorAll?.('.v2p-linha') || [])];
    if (forcar && !linhas().some((l) => l.dataset.linha === estado.v2.aberta)) { Object.assign(estado.v2, { filtro: '', tipo: '', busca: '' }); pintar(); }
    for (const l of linhas()) {
      const ab = l.dataset.linha === estado.v2.aberta;
      l.setAttribute('aria-expanded', String(ab));
      const seta = l.querySelector('.v2p-seta');
      if (seta) { seta.setAttribute('aria-expanded', String(ab)); seta.setAttribute('aria-label', String(seta.getAttribute('aria-label') || '').replace(/^(Abrir|Fechar)/, ab ? 'Fechar' : 'Abrir')); }
      if (ab && forcar) l.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }
  // "Também no RH": abre (ou fecha) uma das partes que saíram do alto da tela.
  function verNoRh(v, ds = {}) {
    estado.v2.ver = v && estado.v2.ver === v && ds.filtro == null && !ds.form ? '' : v;
    if (ds.filtro != null) estado.filtroPedidos = ds.filtro;
    estado.form = ds.form || (estado.v2.ver === 'prazos' ? 'prazos' : estado.form === 'pedido' ? 'pedido' : '');
    pintar();
    estado.janela?.querySelector?.('[data-v2p-secao]')?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
  function pedirTrilha() {
    const leitura = trocarAba('rh');
    Object.assign(estado, { form: 'pedido', editar: null, tipoPedido: 'outro', pedidoTitulo: 'Trilha na Academy: ' });
    pintar();
    return leitura;
  }
  // Busca: redesenha só a lista, para o campo não perder o foco enquanto a pessoa digita.
  function aoDigitar(e) {
    const t = e.target; if (!t?.dataset || !('v2pBusca' in t.dataset)) return;
    estado.v2.busca = t.value; estado.v2.aberta = '';
    const alvo = estado.janela?.querySelector?.('[data-v2p-lista]'), d = estado.dados[estado.aba], f = LISTA_V2[estado.aba];
    if (alvo && d && f) alvo.outerHTML = f(d); else pintar();
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
      const caixa = form?.querySelector('.vp-aniv'); if (caixa) caixa.outerHTML = campoAniversario(nasc, 'Aniversário');
      else { poe('nasc_ano', nasc.slice(0, 4)); poe('nasc_dia', nasc ? String(Number(nasc.slice(8, 10))) : ''); poe('nasc_mes', nasc ? String(Number(nasc.slice(5, 7))) : ''); }
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
    // Baralho do RH: as setas passam de um pedido para o outro (fora de campo de texto).
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && estado.raiz && estado.aba === 'rh' && !e.defaultPrevented && !/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') && estado.janela?.querySelector?.('.v2p-baralho')
      && ![...document.querySelectorAll(ACIMA)].some((el) => !estado.raiz.contains?.(el) && visivel(el))) { e.preventDefault(); moverBaralho(estado.v2.carta + (e.key === 'ArrowRight' ? 1 : -1)); return; }
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
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('change', aoMudar); raiz.addEventListener('input', aoDigitar); raiz.addEventListener('submit', aoEnviar);
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
  window.VybePessoas = { abrir, fechar, aberto, carga, novoPedido, _teste: { eventosDoMes, nascimentoDoForm, andarMes, dataFalada, ver: verNoRh, v2: (m) => { Object.assign(estado.v2, m); pintar(); } } };
})();
