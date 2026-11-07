// vybe-mundo-missoes.js — Missões e cobranças no Irecity (Paulo, 07/11/2026).
//
// No Irecity o Escritório (Habbo) roda por baixo, com o #painel-escritorio
// escondido, e as missões (XP e moedas por tarefa) e as cobranças ("quem está
// cobrando o quê") só existiam dentro dele. Este painel mostra as duas no
// padrão claro (docs/padrao-visual.md), por cima do mapa, com as MESMAS funções
// do Escritório (vybe-escritorio-missoes.js): a mesma carga, os mesmos filtros,
// o mesmo agrupamento por cliente, a mesma linha de cobrança com o botão das
// datas e a mesma gravação. No servidor, só a rota missoes aceitar `pessoa`.
//
//   VybeMissoes.abrir(aba = 'missoes' | 'cobrancas', pessoaId?)  → Promise (termina quando a leitura chega)
//   VybeMissoes.fechar()
//   VybeMissoes.aberto()                                          → boolean
//   VybeMissoes.resumo(pessoaId?)                                 → Promise<{ missoesAtrasadas, missoesHoje, xpEmJogo, cobrancas, … }>
//
// pessoaId é o id do Escritório (escritorio.base.equipe, o mesmo de
// vybe_pessoas) ou o id da pessoa no painel (TEAM_USERS); sem ele, quem está
// logado. Quem vê o quê, como no Escritório:
//  - Missões: as próprias, pela rota escritorio/missoes de sempre. As de outra
//    pessoa só para quem administra e para os sócios: a mesma rota com `pessoa`,
//    que o servidor libera só para quem administra (a mesma regra da ficha de
//    outra pessoa, server/escritorio.js), com o XP e as moedas de verdade. Se o
//    servidor recusar (sócio sem admin) ou a leitura falhar, vêm as tarefas
//    abertas dela no painel (focusOwnItems: as "Minhas tarefas" que viram
//    missões), sem o valor em XP e moedas, com o aviso.
//  - Cobranças: todos veem as de todos (a rota aceita qualquer pessoa: "todos
//    que estão no quarto veem", decisão do Paulo, 19/10/2026).
(function () {
  'use strict';
  // Os sócios (docs/padrao-visual.md §12; a mesma lista de DONOS em vybe-mundo.js).
  const SOCIOS = ['paulo', 'vinicius', 'ewerton', 'deivid'];
  const ABAS = [['missoes', 'Missões'], ['cobrancas', 'Cobranças']];
  // Janelas que abrem por cima deste painel: o Esc é delas primeiro.
  const ACIMA = '#cartao-rapido, #workflow-modal, #workspace-drawer, .brief-overlay, .etq-overlay, dialog[open], #login-gate';
  const estado = { raiz: null, janela: null, antes: null, aba: 'missoes', pessoa: '', carregandoMissoes: false, carregandoCobrancas: false, entrando: false, aviso: '' };
  // Cobranças lidas por pessoa (30 s, o mesmo prazo da leitura do saguão).
  const cobrancasLidas = new Map();
  // Missões de outra pessoa lidas do servidor (60 s, a mesma memória do cartão do Escritório).
  const missoesLidas = new Map();

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const primeiroNome = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().split(/\s+/)[0];
  const base = () => (typeof escritorio !== 'undefined' && escritorio ? escritorio.base : null);
  const hojeIso = () => (typeof escritorioHojeBahia === 'function' ? escritorioHojeBahia() : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bahia' }).format(new Date()));
  const legadoPronto = () => typeof MISSOES_FILTROS !== 'undefined' && [
    typeof carregarMissoesEscritorio, typeof filtroMissoesEscritorio, typeof filtrarMissoesEscritorio, typeof missaoPrazoHtml,
    typeof missaoValorHtml, typeof agruparCobrancas, typeof cobrancaItemHtml, typeof abrirMissaoEscritorio, typeof escritorioApi,
  ].every((t) => t === 'function');
  // Mesma soma do cartão do Escritório ("Concluir tudo vale…").
  const somaValores = (lista) => lista.reduce((t, m) => ({ pontos: t.pontos + (m.recompensa?.pontos || 0), moedas: t.moedas + (m.recompensa?.moedas || 0) }), { pontos: 0, moedas: 0 });

  // ---------- quem ----------
  function pessoaDoEscritorio(id) {
    const equipe = base()?.equipe || [], alvo = String(id ?? '');
    return equipe.find((p) => String(p.id) === alvo)
      || (typeof escritorioIdNasDemandas === 'function' ? equipe.find((p) => escritorioIdNasDemandas(p) === alvo) : null) || null;
  }
  function podeVerOutraPessoa() {
    const b = base();
    if (b?.admin || (typeof souAdmin === 'function' && souAdmin())) return true;
    return SOCIOS.includes(primeiroNome(pessoaDoEscritorio(b?.eu)?.nome));
  }
  function alvoDe(pessoaId) {
    const eu = String(base()?.eu || ''), pedido = pessoaId == null ? '' : String(pessoaId);
    const p = pessoaDoEscritorio(pedido || eu), id = pedido ? String(p?.id || pedido) : eu, propria = id === eu;
    // `achada`: o id é o do Escritório (vybe_pessoas), o único que a rota de missões entende.
    return { id, pessoa: p || { id, nome: '' }, propria, achada: Boolean(p), permitido: propria || podeVerOutraPessoa() };
  }
  const primeiroDe = (a) => String(a.pessoa?.nome || '').split(' ')[0] || 'esta pessoa';

  // ---------- dados (as funções do Escritório) ----------
  // As de outra pessoa: as tarefas abertas dela no painel, no formato das missões.
  function missoesDoPainel(pessoa) {
    if (typeof focusOwnItems !== 'function' || typeof TEAM_USERS === 'undefined') return null;
    const idPainel = typeof escritorioIdNasDemandas === 'function' ? escritorioIdNasDemandas(pessoa) : String(pessoa.id);
    const user = (TEAM_USERS || []).find((u) => String(u.id) === String(idPainel));
    if (!user) return null;
    let itens;
    try { itens = focusOwnItems(user) || []; } catch { return null; }
    const hoje = hojeIso();
    // A data é o prazo; sem prazo, a veiculação (a mesma regra de missoesDaPessoa no servidor).
    return itens.map((d) => {
      const quando = d.prazo_iso || d.veiculacao_iso || null;
      return { ref: String(d.id), quadro: typeof isRequestItem === 'function' && isRequestItem(d) ? 'demandas' : 'producao',
        titulo: d.nome || d.titulo || 'Sem título', cliente: d.cliente || '', formato: d.formato || '', status: d.status || '', grupo: d.grupo || '',
        prazo: quando, tipo_data: d.prazo_iso ? 'prazo' : d.veiculacao_iso ? 'veiculacao' : null,
        atrasada: Boolean(quando && quando < hoje), hoje: quando === hoje, recompensa: null, bonus: null };
    }).sort((x, y) => String(x.prazo || '9').localeCompare(String(y.prazo || '9')));
  }
  function dadosMissoes(a) {
    if (a.propria) {
      const m = escritorio.missoes;
      return m ? { lista: m.missoes || [], erro: m.erro || '', indisponivel: Boolean(m.indisponivel), valores: true } : null;
    }
    if (!a.permitido) return { proibido: true, lista: [] };
    // Do servidor (quem administra): com o XP e as moedas.
    const lida = a.achada ? missoesLidas.get(a.id) : null;
    if (lida?.lista) return { lista: lida.lista, erro: lida.erro || '', indisponivel: Boolean(lida.indisponivel), valores: true };
    if (a.achada && !lida) return null; // ainda lendo
    // Recusou, falhou ou a pessoa não está no Escritório: as tarefas do painel, sem o valor.
    const motivo = lida?.recusado ? 'recusado' : lida?.erro ? 'falhou' : 'fora';
    const lista = missoesDoPainel(a.pessoa), erro = lida?.erro || '';
    return lista ? { lista, valores: false, motivo, erro } : { semPainel: true, lista: [], erro };
  }
  // As de outra pessoa: a mesma rota com `pessoa`. O servidor só libera para
  // quem administra; a recusa (403) fica guardada como as leituras, e a tela
  // volta às tarefas do painel. Nunca rejeita.
  async function carregarMissoesDeOutra(id, forcar) {
    const atual = missoesLidas.get(id);
    if (!forcar && atual && !atual.erro && Date.now() - atual.em < 60_000) return atual;
    let r;
    try {
      const d = await escritorioApi('missoes', null, { pessoa: id });
      r = { em: Date.now(), lista: d.disponivel === false ? [] : d.missoes || [], indisponivel: d.disponivel === false };
    } catch (e) {
      r = e?.status === 403 ? { em: Date.now(), recusado: true }
        : { em: Date.now(), lista: atual?.lista, indisponivel: atual?.indisponivel, erro: e?.message || 'Não foi possível ler as missões.' };
    }
    missoesLidas.set(id, r);
    return r;
  }
  async function carregarMissoes(forcar) {
    await carregarMissoesEscritorio(forcar);
    // Uma leitura já em andamento (o saguão, o cartão do quarto) faz a de cima
    // voltar antes da resposta: força outra, que pega carona na mesma ida ao servidor.
    if (!escritorio.missoes) await carregarMissoesEscritorio(true);
  }
  // A mesma leitura do quarto (carregarCobrancasEscritorio), sem os bonecos:
  // reaproveita a do saguão (até 30 s, da mesma pessoa) e agrupa por cliente.
  async function carregarCobrancas(id, forcar) {
    const atual = cobrancasLidas.get(id);
    if (!forcar && atual && !atual.erro && Date.now() - atual.em < 30_000) return atual;
    let lista;
    try {
      const lida = escritorio.cobrancasDoLobby;
      if (!forcar && lida?.pessoa === id && Date.now() - lida.em < 30_000) lista = lida.lista;
      else lista = (await escritorioApi('cobrancas', null, { pessoa: id })).cobrancas || [];
    } catch (e) {
      const r = { em: Date.now(), lista: atual?.lista || [], grupos: atual?.grupos || [], erro: e?.message || 'Não foi possível ler as cobranças.' };
      cobrancasLidas.set(id, r);
      return r;
    }
    const r = { em: Date.now(), lista, grupos: agruparCobrancas(lista), erro: '' };
    cobrancasLidas.set(id, r);
    return r;
  }
  async function carregar(forcar = false) {
    if (!base() || !legadoPronto()) return;
    const a = alvoDe(estado.pessoa), tarefas = [];
    if (a.propria || (a.permitido && a.achada)) {
      estado.carregandoMissoes = true;
      const leitura = a.propria ? carregarMissoes(forcar) : carregarMissoesDeOutra(a.id, forcar);
      tarefas.push(leitura.catch(() => {}).finally(() => { estado.carregandoMissoes = false; pintar(); }));
    }
    estado.carregandoCobrancas = true;
    tarefas.push(carregarCobrancas(a.id, forcar).finally(() => { estado.carregandoCobrancas = false; pintar(); }));
    await Promise.all(tarefas);
  }

  // ---------- desenho ----------
  const carregandoHtml = (texto) => `<p class="vv-missoes-carregando" role="status">${esc(texto)}</p>`;
  const vazioHtml = (titulo, texto, extra = '') => `<div class="vv-missoes-vazio"><b>${esc(titulo)}</b>${texto ? `<p>${esc(texto)}</p>` : ''}${extra}</div>`;
  const erroHtml = (texto) => `<p class="vv-missoes-erro">Não foi possível atualizar: ${esc(texto)} <button type="button" data-vm-recarregar>Tentar de novo</button></p>`;
  // Missões de outra pessoa sem o valor (as tarefas do painel): o porquê.
  const NOTA_SEM_VALOR = {
    recusado: 'Sem XP e moedas: o valor das missões de outra pessoa só sai para quem administra.',
    falhou: 'Sem XP e moedas: o valor das missões não chegou. Estas são as tarefas abertas no painel.',
    fora: 'Sem XP e moedas: esta pessoa não está no Escritório, onde o valor de cada missão é calculado.',
  };

  function linhaMissao(m) {
    const tom = m.atrasada ? ' atrasada' : m.hoje ? ' hoje' : '';
    const dica = typeof missaoDicaTexto === 'function' ? missaoDicaTexto(m) : m.titulo;
    return `<li><button type="button" class="vv-missoes-linha${tom}" data-vm-missao="${esc(m.ref)}" data-vm-quadro="${esc(m.quadro)}" title="${esc(dica)}">
      <span class="vv-missoes-linha-topo">${missaoPrazoHtml(m)}<span class="vv-missoes-valor">${missaoValorHtml(m.recompensa)}</span></span>
      <b class="vv-missoes-titulo">${esc(m.titulo)}</b>
      ${typeof missaoEtiquetasHtml === 'function' ? missaoEtiquetasHtml(m) : ''}
      <span class="vv-missoes-abrir" aria-hidden="true">Abrir</span>
    </button></li>`;
  }
  function htmlMissoes(a) {
    const d = dadosMissoes(a);
    if (d?.proibido) return vazioHtml(`As missões de ${primeiroDe(a)} são só para a gestão`, 'Quem administra e os sócios veem as missões de outra pessoa. As cobranças estão na outra aba.');
    if (!d) return estado.carregandoMissoes ? carregandoHtml('Carregando as missões…') : vazioHtml('Sem missões por enquanto', 'Ainda não deu para ler as missões.', '<button type="button" class="vv-missoes-acao" data-vm-recarregar>Tentar de novo</button>');
    if (d.indisponivel) return vazioHtml('As missões ainda não estão ligadas', 'O banco do Escritório ainda não tem a tabela de pontos.');
    if (d.semPainel) return (d.erro ? erroHtml(d.erro) : '') + vazioHtml(`Sem as tarefas de ${primeiroDe(a)}`, 'A produção ainda não carregou neste navegador. Abra a Produção e volte aqui.');
    const lista = d.lista;
    const nota = d.valores ? '' : `<p class="vv-missoes-nota">${esc(NOTA_SEM_VALOR[d.motivo] || NOTA_SEM_VALOR.fora)}</p>`;
    if (!lista.length) return (d.erro ? erroHtml(d.erro) : '') + nota + vazioHtml('Nenhuma missão aberta', a.propria ? 'Nenhuma tarefa aberta com você. Quando uma demanda chegar, ela aparece aqui com o que vale.' : `${primeiroDe(a)} não tem tarefa aberta.`);
    // Os filtros e a escolha guardada são os do cartão do Escritório.
    const conta = Object.fromEntries(MISSOES_FILTROS.map(([k, , f]) => [k, lista.filter(f).length]));
    const filtro = filtroMissoesEscritorio(lista), [, rotulo, passa] = MISSOES_FILTROS.find(([k]) => k === filtro);
    const filtradas = lista.filter(passa), total = somaValores(lista);
    return `${d.erro ? erroHtml(d.erro) : ''}${nota}
      ${d.valores && (total.pontos || total.moedas) ? `<p class="vv-missoes-total">Concluir tudo vale ${missaoValorHtml(total)}</p>` : ''}
      <div class="vv-missoes-filtros" role="group" aria-label="Filtrar missões">${MISSOES_FILTROS.map(([k, rot]) => `<button type="button" data-vm-filtro="${k}" aria-pressed="${k === filtro}"${k === 'atrasadas' && conta[k] ? ' class="alerta"' : ''}>${rot}<span class="vv-missoes-badge">${conta[k]}</span></button>`).join('')}</div>
      ${filtradas.length ? `<ol class="vv-missoes-lista">${filtradas.map(linhaMissao).join('')}</ol>` : `<p class="vv-missoes-nada">Nada em "${esc(rotulo)}".</p>`}`;
  }
  function htmlCobrancas(a) {
    const c = cobrancasLidas.get(a.id);
    if (!c) return carregandoHtml('Vendo quem está cobrando…');
    const erro = c.erro ? erroHtml(c.erro) : '';
    if (!c.grupos.length) return erro + vazioHtml('Ninguém cobrando', a.propria ? 'Nenhum cliente esperando por você agora.' : `Nenhum cliente esperando por ${primeiroDe(a)} agora.`);
    const cliente = (g) => (typeof cobrancaClienteHtml === 'function' ? cobrancaClienteHtml(g) : `<b>${esc(g.cliente)}</b>`);
    // Abrir uma demanda tira o painel da frente, como o cartão do cliente no quarto.
    return `${erro}<p class="vv-missoes-resumo">${plural(c.grupos.length, 'cliente', 'clientes')} · ${plural(c.lista.length, 'demanda', 'demandas')}. Clique numa demanda para abrir; no calendário dela, veja e mude as datas.</p>
      <ul class="vv-missoes-clientes">${c.grupos.map((g) => `<li class="vv-missoes-cliente">${cliente(g)}<ul class="vv-missoes-cobrancas">${g.itens.map((x) => cobrancaItemHtml(x, 'VybeMissoes.fechar({foco:false})')).join('')}</ul></li>`).join('')}</ul>`;
  }
  function badge(aba, a) {
    if (!a) return '';
    if (aba === 'missoes') {
      const d = dadosMissoes(a);
      if (!d || d.proibido || d.semPainel || d.indisponivel) return '';
      return `<span class="vv-missoes-badge${d.lista.some((m) => m.atrasada) ? ' alerta' : ''}">${d.lista.length}</span>`;
    }
    const c = cobrancasLidas.get(a.id);
    return c ? `<span class="vv-missoes-badge${c.lista.some((x) => x.tipo === 'atrasada') ? ' alerta' : ''}">${c.lista.length}</span>` : '';
  }
  function htmlPainel() {
    const b = base(), a = b ? alvoDe(estado.pessoa) : null, outra = a && !a.propria;
    let corpo;
    if (!b) corpo = vazioHtml('Entre no Escritório para ver as missões', 'As missões e as cobranças vêm do Escritório: o XP, as moedas e os clientes esperando no seu quarto.',
      `<button type="button" class="vv-missoes-acao" data-vm-entrar${estado.entrando ? ' disabled' : ''}>${estado.entrando ? 'Entrando…' : 'Entrar no Escritório'}</button>`);
    else if (!legadoPronto()) corpo = vazioHtml('As missões não carregaram', 'O Escritório desta página está sem as funções de missões. Atualize a página.');
    else corpo = estado.aba === 'cobrancas' ? htmlCobrancas(a) : htmlMissoes(a);
    const titulo = outra ? `Missões e cobranças de ${primeiroDe(a)}` : 'Suas missões e cobranças';
    const sub = outra ? `O que ${primeiroDe(a)} tem para entregar e os clientes cobrando.` : 'O que você tem para entregar e os clientes cobrando você.';
    return `<div class="vv-missoes-topo">
        <div><span class="vv-missoes-kicker">Escritório</span><h2 id="vv-missoes-titulo">${esc(titulo)}</h2><p>${esc(sub)}</p></div>
        <button type="button" class="vv-missoes-x" data-vm-fechar aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="vv-missoes-abas" role="tablist" aria-label="Missões ou cobranças">${ABAS.map(([k, rot]) => `<button type="button" role="tab" id="vv-missoes-aba-${k}" aria-controls="vv-missoes-corpo" aria-selected="${k === estado.aba}" data-vm-aba="${k}">${rot}${badge(k, a)}</button>`).join('')}</div>
      <p class="vv-missoes-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vv-missoes-corpo" id="vv-missoes-corpo" role="tabpanel" aria-labelledby="vv-missoes-aba-${estado.aba}">${corpo}</div>`;
  }
  // A janela é criada uma vez (a entrada anima só ao abrir); cada desenho troca o conteúdo dela.
  function pintar({ forcado = false } = {}) {
    const janela = estado.janela;
    if (!janela) return;
    // Alguém mudando as datas de uma cobrança: a leitura que chega espera (como no quarto).
    if (!forcado && janela.querySelector?.('.ofc-cobranca-datas')) return;
    const foco = document.activeElement, dentro = Boolean(foco && janela.contains?.(foco));
    const chave = dentro ? (foco.dataset?.vmAba ? ['vm-aba', foco.dataset.vmAba] : foco.dataset?.vmFiltro ? ['vm-filtro', foco.dataset.vmFiltro] : null) : null;
    janela.innerHTML = htmlPainel();
    if (chave) janela.querySelector?.(`[data-${chave[0]}="${chave[1]}"]`)?.focus?.();
    else if (dentro) janela.querySelector?.('[role="tab"][aria-selected="true"]')?.focus?.();
  }
  function avisar(texto) {
    estado.aviso = texto;
    const el = estado.raiz?.querySelector?.('.vv-missoes-aviso');
    if (el) el.textContent = texto;
  }

  // ---------- ações ----------
  // A peça abre no cartão rápido de sempre, ancorado na linha (abrirMissaoEscritorio);
  // o painel sai da frente, como o cartão do cliente no quarto.
  function abrirPeca(botao) {
    abrirMissaoEscritorio(botao.dataset.vmMissao, botao.dataset.vmQuadro, { currentTarget: botao });
    fechar({ foco: false });
  }
  // O botão do calendário de cada cobrança abre os campos do Escritório
  // (abrirDatasCobrancaEscritorio, no próprio onclick); o Salvar continua sendo
  // salvarDatasCobrancaEscritorio, e aqui só se relê a lista depois de gravar.
  function ligarSalvar(botao) {
    const salvar = botao.closest?.('li')?.querySelector?.('.ofc-cobranca-datas .ofc-p-entrar');
    if (salvar) salvar.onclick = () => salvarDatas(salvar);
  }
  async function salvarDatas(botao) {
    const div = botao.closest('.ofc-cobranca-datas'), abrir = botao.closest('li')?.querySelector('.ofc-cobranca-datas-abrir');
    if (!abrir || typeof salvarDatasCobrancaEscritorio !== 'function') return;
    await salvarDatasCobrancaEscritorio(botao, abrir.dataset.ref, abrir.dataset.quadro);
    // O Escritório avisa no canto dele (escondido aqui): o mesmo texto vai para o painel.
    if (div?.isConnected) { avisar(document.getElementById('office-feedback')?.textContent || 'As datas não foram salvas. Confira e tente de novo.'); return; }
    avisar('Datas salvas.');
    // Dá tempo de a gravação chegar ao banco, como escritorioAposMudancaDeDemanda.
    setTimeout(() => { if (aberto()) carregar(true); }, 2500);
  }
  async function entrar() {
    if (estado.entrando || typeof abrirEscritorio !== 'function') return;
    estado.entrando = true;
    pintar({ forcado: true });
    try { await abrirEscritorio(); } catch { /* o Escritório mostra o erro dele */ }
    estado.entrando = false;
    if (!aberto()) return;
    estado.aviso = base() ? '' : 'Não deu para entrar no Escritório agora. Tente de novo em instantes.';
    const leitura = carregar();
    pintar({ forcado: true });
    await leitura;
  }
  function aoClicar(e) {
    const t = e.target;
    if (t === estado.raiz) { fechar(); return; } // o fundo
    const perto = (sel) => t?.closest?.(sel);
    let b;
    if (perto('[data-vm-fechar]')) fechar();
    else if ((b = perto('[data-vm-aba]'))) { estado.aba = b.dataset.vmAba === 'cobrancas' ? 'cobrancas' : 'missoes'; estado.aviso = ''; pintar({ forcado: true }); }
    else if ((b = perto('[data-vm-filtro]'))) { filtrarMissoesEscritorio(b.dataset.vmFiltro); pintar({ forcado: true }); }
    else if ((b = perto('[data-vm-missao]'))) abrirPeca(b);
    else if (perto('[data-vm-entrar]')) entrar();
    else if (perto('[data-vm-recarregar]')) { estado.aviso = ''; carregar(true).catch(() => {}); pintar({ forcado: true }); }
    else if ((b = perto('.ofc-cobranca-datas-abrir'))) ligarSalvar(b);
  }
  const visivel = (el) => Boolean(el.getClientRects?.().length);
  // Esc fecha de dentro para fora: o calendário, os campos de data e, por fim, o painel.
  function aoTeclar(e) {
    if (e.key !== 'Escape' || !estado.raiz || e.defaultPrevented) return;
    if ([...document.querySelectorAll(ACIMA)].some((el) => !estado.raiz.contains?.(el) && visivel(el))) return;
    e.preventDefault();
    e.stopPropagation();
    const cal = estado.raiz.querySelector?.('.ofc-datas-calendario'), datas = estado.raiz.querySelector?.('.ofc-cobranca-datas');
    if (cal) { cal.closest('.ofc-cobranca-datas')?.querySelectorAll('.ofc-datas-valor').forEach((v) => v.setAttribute('aria-expanded', 'false')); cal.remove(); return; }
    if (datas) { const abrir = datas.closest('li')?.querySelector('.ofc-cobranca-datas-abrir'); datas.remove(); abrir?.setAttribute('aria-expanded', 'false'); abrir?.focus?.(); return; }
    fechar();
  }

  // ---------- API ----------
  function abrir(aba = 'missoes', pessoaId) {
    estado.aba = aba === 'cobrancas' ? 'cobrancas' : 'missoes';
    estado.pessoa = pessoaId == null || pessoaId === '' ? '' : String(pessoaId);
    estado.aviso = '';
    if (!estado.raiz) {
      estado.antes = document.activeElement || null;
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vv-missoes-camada';
      janela.id = 'vv-missoes';
      janela.className = 'vv-missoes';
      janela.setAttribute('role', 'dialog');
      janela.setAttribute('aria-modal', 'true');
      janela.setAttribute('aria-labelledby', 'vv-missoes-titulo');
      raiz.append(janela);
      raiz.addEventListener('click', aoClicar);
      document.body.append(raiz);
      Object.assign(estado, { raiz, janela });
    }
    // A leitura começa antes do desenho, para ele já sair com "Carregando…".
    const leitura = carregar();
    pintar({ forcado: true });
    estado.janela.querySelector?.('[role="tab"][aria-selected="true"]')?.focus?.();
    return leitura;
  }
  function fechar(opcoes = {}) {
    const raiz = estado.raiz, antes = estado.antes;
    if (!raiz) return;
    Object.assign(estado, { raiz: null, janela: null, antes: null });
    raiz.remove();
    if (opcoes.foco !== false && antes?.isConnected) antes.focus?.();
  }
  const aberto = () => Boolean(estado.raiz);
  // Para o cartão do HUD. Número desconhecido vem null (sem Escritório, sem
  // permissão, leitura que falhou); XP e moedas só quando o servidor calculou
  // (as próprias, ou as de outra pessoa para quem administra).
  async function resumo(pessoaId) {
    const vazio = { missoesAtrasadas: null, missoesHoje: null, xpEmJogo: null, moedasEmJogo: null, cobrancas: null, clientesCobrando: null };
    if (!base() || !legadoPronto()) return { ...vazio, semEscritorio: !base() };
    const a = alvoDe(pessoaId);
    const missoes = a.propria ? carregarMissoes(false).catch(() => {}) : a.permitido && a.achada ? carregarMissoesDeOutra(a.id, false) : null;
    const [, c] = await Promise.all([missoes, carregarCobrancas(a.id, false)]);
    const m = dadosMissoes(a), lista = m?.lista || [];
    const temMissoes = Boolean(m && !m.proibido && !m.semPainel && !m.indisponivel && !(m.erro && !lista.length));
    const total = somaValores(lista);
    return { ...vazio, pessoaId: a.id,
      ...(temMissoes ? { missoesAtrasadas: lista.filter((x) => x.atrasada).length, missoesHoje: lista.filter((x) => x.hoje).length } : {}),
      ...(temMissoes && m.valores ? { xpEmJogo: total.pontos, moedasEmJogo: total.moedas } : {}),
      ...(c.erro && !c.lista.length ? {} : { cobrancas: c.lista.length, clientesCobrando: c.grupos.length }) };
  }

  window.addEventListener('keydown', aoTeclar, true);
  window.VybeMissoes = { abrir, fechar, aberto, resumo };
})();
