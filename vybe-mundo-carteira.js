// vybe-mundo-carteira.js — o módulo Carteira do Irecity (Paulo, 07/11/2026, inspirado no AgencyFlow).
//
// Uma janela do padrão claro (docs/padrao-visual.md) por cima do mapa, com quatro abas:
//  - Saúde: a nota 0–100 e o risco de churn de cada cliente ativo (vybe-carteira-saude.js). A tela é o quadro
//    "Saúde da carteira" do moodboard (12/11/2026): fala do Mateus, três números, fichas de filtro e a lista de
//    "quem precisa de você", em que a linha abre no lugar; a média mês a mês e as contas por head ficam em "Mês a mês".
//  - Onboarding: a esteira de cada cliente novo (etapas configuráveis), com checklist, responsável por
//    etapa e "parada desde". A tela é o quadro "Onboarding": "Pede ação" antes de "Andando", a linha abre no lugar.
//  - Churn: quem saiu, quando, como e por quê; taxa, receita perdida, tempo até sair e o cohort de
//    retenção.
//  - Contratos: valor mensal, início, renovação e status; renovações dos próximos 30 dias em destaque;
//    tempo de casa (LTV), receita estimada do LTV, clientes novos, tempo restante médio e o mês a mês
//    (ativos, novos, LTV médio, ticket médio). Saídas e entradas por mês na aba Churn; contas por head
//    na Saúde (Paulo, 08/11/2026, AgencyFlow: Clientes e Finanças).
// Topo: Mensal/Anual e o mês (valem para Churn e Contratos; a Saúde compara com o mês anterior).
// Dados: DADOS_ALL/unifiedOperationalItems e CADASTRO_CLIENTES (os mesmos do painel, só clientes ativos
// com o nome do cadastro) e GET /api/painel?area=carteira (server/carteira.js). Quem grava e confere é
// o servidor. Sem a migração 2026-11-07-carteira.sql, a Saúde funciona e o resto mostra "aguardando
// ativação".
//
//   VybeCarteira.abrir(aba = 'saude' | 'onboarding' | 'churn' | 'contratos')  → Promise (fim da leitura)
//   VybeCarteira.fechar()
//   VybeCarteira.aberto()                                                     → boolean
//   VybeCarteira.dados()  → [{ cliente, clienteId, score, risco, motivos[], head }] (a última conta; sem
//                           ela, calcula na hora com o que o painel tem, sem os sinais do servidor)
//
// O botão no trilho é ligado por quem mexe em vybe-mundo.js; aqui só a janela.
(function () {
  // Cliente com a cor da carteira (cliCor de vybe-core.js); fora do painel (testes), o nome escapado.
  function cliCor(n) { const g = globalThis.cliCor; return typeof g === 'function' && g !== cliCor ? g(n) : String(n ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  'use strict';
  const ABAS = [['saude', 'Saúde'], ['onboarding', 'Onboarding'], ['churn', 'Churn'], ['contratos', 'Contratos']];
  // O cabeçalho da página (Padrão Vybe): o título igual ao do dock e uma frase do que a tela faz.
  const TITULO_DA_ABA = { saude: 'Saúde da carteira', onboarding: 'Onboarding', churn: 'Churn', contratos: 'Contratos' };
  const FRASE_DA_ABA = { saude: 'A nota de cada cliente ativo, de 0 a 100, e quem precisa de atenção primeiro.', onboarding: 'A entrada de cada cliente novo ou contrato novo, etapa por etapa.',
    churn: 'Quem saiu, por quê e quanto de receita foi junto.', contratos: 'Valor mensal, início e renovação de cada cliente ativo.', carteira: 'Saúde, onboarding, churn e contratos dos clientes.' };
  const ACIMA = '#cartao-rapido, #workflow-modal, #workspace-drawer, .brief-overlay, .etq-overlay, dialog[open], #login-gate';
  const PAGINA = 10;
  const API = '/api/painel?area=carteira';
  const estado = {
    raiz: null, janela: null, antes: null, aba: 'saude', tipo: 'mensal', mes: '', servidor: null, erro: '', carregando: false,
    saude: null, aviso: '', ajuda: false, ordem: { saude: 'risco', churn: 'recente', contratos: 'renovacao' }, risco: 'precisam', head: 'todos',
    visao: 'agora', filtros: false, novoOnb: false, buscaOnb: '', etapaOnb: 'todas',
    limite: {}, abertos: new Set(), form: null, editorEtapas: null, salvando: false, verEncerrados: false, verFalta: false, rotulo: '',
    busca: {}, buscaAberta: false, filtroCt: 'todos', filtroCh: 'todas', serieCt: 'ativos', vistaCt: 'lista', vistaCh: 'meses', registrar: false, histCh: false,
  };

  // ---------- utilidades ----------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const dois = (n) => String(n).padStart(2, '0');
  const diaLocal = (d = new Date()) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
  const hoje = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : diaLocal());
  const dataCurta = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(2, 4)}` : '—');
  const diaDoCarimbo = (v) => { const d = v ? new Date(v) : null; return d && !Number.isNaN(d.getTime()) ? diaLocal(d) : ''; };
  const reais = (v) => (v == null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v));
  const S = () => window.VybeCarteiraSaude;
  const RISCO_TXT = { alto: 'Risco alto', medio: 'Risco médio', baixo: 'Risco baixo' };
  const NIVEL_RISCO = { alto: 'u1', medio: 'u2', baixo: 'u6' };
  const STATUS_CONTRATO = { ativo: ['Ativo', 'u6'], negociando: ['Negociando', 'u4'], aviso_previo: ['Aviso prévio', 'u3a'], encerrado: ['Encerrado', 'u5'] };
  const TIPOS = () => S()?.TIPOS_CHURN || {};
  const MOTIVOS = () => S()?.MOTIVOS_CHURN || {};
  // Tempo de casa (LTV) e tempo restante em texto curto.
  const virgula = (x) => String(x).replace('.', ',');
  const mesesTxt = (m) => (m == null ? 'sem data' : m < 1 ? 'menos de 1 mês' : m === 1 ? '1 mês' : `${virgula(m)} meses`);
  const FONTE_ENTRADA = { contrato: 'início do contrato', cadastro: 'entrada no cadastro', historico: 'primeiro registro do cliente' };
  function restanteTxt(dias) {
    if (dias == null) return '';
    if (dias === 0) return 'renova hoje';
    if (dias < 60) return `faltam ${plural(dias, 'dia', 'dias')}`;
    return `faltam ${mesesTxt(Math.round((dias / (S()?.DIAS_MES || 30.44)) * 10) / 10)}`;
  }
  const casaTxt = (l) => (!l || l.mesesLtv == null ? 'Tempo de casa: sem data de entrada'
    : `Com a Vybe há ${mesesTxt(l.mesesLtv)} (desde ${dataCurta(l.entrada)}, ${FONTE_ENTRADA[l.fonteEntrada] || 'entrada'})`);
  const contratoTxt = (l) => (!l ? '' : l.vencida ? `renovação vencida em ${dataCurta(l.renovacao)}` : l.diasRestantes != null ? `${restanteTxt(l.diasRestantes)} para a renovação`
    : l.status === 'encerrado' ? 'contrato encerrado' : 'sem data de renovação');
  // Valor curto para cima da barra: 2.500 → "2,5 mil".
  const milTxt = (v) => (v == null ? '' : v >= 1000 ? `${virgula(Math.round(v / 100) / 10)} mil` : String(Math.round(v)));

  // Barras mês a mês em SVG inline, com o número em cima de cada barra (o mesmo jeito de barrasSemana
  // em vybe-mundo.js). `espiar(p)` devolve a chave do mini painel daquele mês (opcional).
  function barrasMes(pontos, campo, { titulo, formato = (x) => virgula(x), cor = '#FF7A2F', fraca = '#E1DACE', espiar = null, w = 340, h = 78, zero = 'Zero em todos os meses.' } = {}) {
    const vals = (pontos || []).map((p) => p[campo]);
    if (!vals.length || vals.every((v) => v == null)) return `<figure class="vc-graf"><figcaption>${esc(titulo)}</figcaption>${nota('Sem dado para este gráfico ainda.')}</figure>`;
    // Redesign (quadros 00 e 18): gráfico só de zeros vira uma linha discreta, não seis barras de "0".
    if (vals.every((v) => !Number(v))) return `<figure class="vc-graf"><figcaption>${esc(titulo)}</figcaption>${nota(zero)}</figure>`;
    const max = Math.max(1, ...vals.filter((v) => v != null));
    const bw = w / pontos.length, T = 13;
    // Barra estreita (12 meses): rótulo e número um sim, um não, contando do último (auditoria 09/11: "02/2603/26" colados).
    const passo = bw < 34 ? 2 : 1, mostra = (i, p) => p.agora || (pontos.length - 1 - i) % passo === 0;
    const desc = pontos.map((p) => `${p.rotulo} ${p[campo] == null ? 'sem dado' : formato(p[campo])}`).join(', ');
    return `<figure class="vc-graf"><figcaption>${esc(titulo)}</figcaption>
      <svg class="vc-graf-svg" viewBox="0 0 ${w} ${h + 16 + T}" role="img" aria-label="${esc(`${titulo}: ${desc}`)}"><g transform="translate(0 ${T})">${pontos.map((p, i) => {
        const v = p[campo], x = i * bw, alt = v == null ? 0 : (v / max) * h, chave = espiar && v ? espiar(p) : '';
        return `<g${chave ? ` data-espiar="carteira:${esc(chave)}" role="button" tabindex="0" aria-label="${esc(`${titulo}, ${p.rotulo}: ${formato(v)}`)}"` : ''}><title>${esc(`${p.rotulo}: ${v == null ? 'sem dado' : formato(v)}`)}</title>
          ${v == null ? '' : `<rect x="${(x + bw * 0.18).toFixed(1)}" y="${(h - Math.max(alt, 1.5)).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(alt, 1.5).toFixed(1)}" rx="2" fill="${p.agora ? cor : fraca}"/>`}
          ${v == null || !mostra(i, p) ? '' : `<text x="${(x + bw / 2).toFixed(1)}" y="${Math.max(9, h - Math.max(alt, 1.5) - 3).toFixed(1)}" text-anchor="middle" class="n">${esc(formato(v))}</text>`}
          ${mostra(i, p) ? `<text x="${(x + bw / 2).toFixed(1)}" y="${h + 13}" text-anchor="middle" class="${p.agora ? 'agora' : ''}">${esc(p.rotulo)}</text>` : ''}</g>`;
      }).join('')}</g></svg></figure>`;
  }
  // Série mês a mês até o mês escolhido no topo (12 meses; começo vazio sai, ficam pelo menos 6).
  function serieDosMeses() {
    const sv = estado.servidor;
    if (!sv?.clientes || !S()?.serieMensal) return null;
    return S().serieMensal({ clientes: sv.clientes, contratos: listaContratos(), hoje: hoje(), ate: estado.mes, meses: 12, minimo: 6 });
  }
  // Contratos: só os do Vybe OS (14/11/2026: o Vybe Finanças saiu; VybeFinancas.contratosDaCarteira devolve a lista como está).
  const finCarteira = () => { const d = window.VybeFinancas?.estado?.('carteira')?.dados; return d?.conectado ? d : null; };
  const listaContratos = () => { const l = estado.servidor?.contratos?.lista || []; return window.VybeFinancas?.contratosDaCarteira ? window.VybeFinancas.contratosDaCarteira(l) : l; };
  const contratosAgora = () => {
    const sv = estado.servidor;
    return sv?.clientes ? S().contratos({ clientes: sv.clientes, contratos: listaContratos(), hoje: hoje(), tipo: estado.tipo, mes: estado.mes }) : null;
  };

  function pecas() {
    if (typeof unifiedOperationalItems === 'function') { try { return unifiedOperationalItems() || []; } catch { /* cai para DADOS_ALL */ } }
    return typeof DADOS_ALL !== 'undefined' && Array.isArray(DADOS_ALL) ? DADOS_ALL : [];
  }
  const cadastro = () => (typeof CADASTRO_CLIENTES !== 'undefined' && Array.isArray(CADASTRO_CLIENTES) ? CADASTRO_CLIENTES : []);

  // ---------- dados ----------
  function calcularSaude() {
    if (!S() || !window.VybeDono) return null;
    const sv = estado.servidor;
    try {
      return S().calcular({ demandas: pecas(), clientes: cadastro(), sinais: sv?.sinais || null,
        clima: sv?.clima?.disponivel ? sv.clima : null, hoje: hoje() });
    } catch (e) { console.warn('Carteira: não deu para calcular a saúde.', e); return null; }
  }
  async function pedir(corpo) {
    const r = await fetch(API, corpo ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
      : { credentials: 'same-origin', cache: 'no-store' });
    let d = {};
    try { d = await r.json(); } catch { /* corpo vazio */ }
    if (!r.ok) throw Object.assign(new Error(d?.error || `A Carteira não respondeu (${r.status}).`), { status: r.status, aguardando: Boolean(d?.aguardando) });
    return d;
  }
  // A nota do mês fica guardada para o histórico e para as outras partes (uma vez por dia por navegador).
  async function guardarNotas() {
    const r = estado.saude, sv = estado.servidor;
    if (!r?.clientes?.length || !sv?.historico?.disponivel) return;
    const chave = `vybe.carteira.notas.${hoje()}`;
    try { if (localStorage.getItem(chave)) return; } catch { /* sem armazenamento: grava */ }
    const itens = r.clientes.filter((c) => c.id).map((c) => ({ cliente_id: c.id, score: c.score, risco: c.risco,
      motivos: c.motivos.filter((m) => m.tom === 'ruim').slice(0, 8).map((m) => m.texto.slice(0, 160)), heads: c.heads.join(', ').slice(0, 200) }));
    if (!itens.length) return;
    try { await pedir({ acao: 'saude_registrar', itens }); try { localStorage.setItem(chave, '1'); } catch { /* ok */ } }
    catch (e) { console.warn('Carteira: nota do mês não foi guardada.', e?.message); }
  }
  async function carregar() {
    estado.carregando = true;
    estado.erro = '';
    pintar();
    if (!cadastro().length && typeof ensureClientMasterSources === 'function') { try { await ensureClientMasterSources(); } catch { /* o cadastro avisa */ } }
    try { estado.servidor = await pedir(); }
    catch (e) { if (e.aguardando) estado.servidor = { aguardando: true }; else estado.erro = e.message; }
    // Os contratos do Vybe Finanças não são mais lidos (14/11/2026): a Carteira segue só com o registro do Vybe OS.
    estado.saude = calcularSaude();
    estado.carregando = false;
    pintar();
    guardarNotas();
  }
  async function gravar(corpo, ok) {
    if (estado.salvando) return;
    estado.salvando = true;
    avisar('Salvando…');
    try {
      await pedir(corpo);
      estado.form = null;
      estado.servidor = await pedir();
      estado.saude = calcularSaude();
      estado.aviso = ok || 'Salvo.';
    } catch (e) { estado.aviso = e.aguardando ? 'Esta parte ainda está sendo ligada.' : e.message; }
    estado.salvando = false;
    pintar();
  }

  // ---------- pedaços de tela ----------
  const vazio = (frase, botao = '', extra = '') => `<div class="vc-vazio"><p>${esc(frase)}</p>${botao}${extra}</div>`;
  const acao = (rotulo, attrs) => `<button type="button" class="vc-acao" ${attrs}>${esc(rotulo)}</button>`;
  const secundario = (rotulo, attrs) => `<button type="button" class="vc-sec" ${attrs}>${esc(rotulo)}</button>`;
  const etiqueta = (texto, nivel) => `<em class="vc-tag ${nivel}">${esc(texto)}</em>`;
  // Parte que ainda não foi ligada (redesign, quadro 56): um aviso neutro para a equipe, sem nome de arquivo nem de pessoa
  // e sem "Tentar de novo" (não é erro). O detalhe técnico fica em "Ver o que falta", só para quem administra.
  const souAdminAqui = () => { try { return typeof souAdmin === 'function' && Boolean(souAdmin()); } catch { return false; } };
  const aguardando = (titulo, texto) => `<div class="vc-ativacao" role="note"><b>${esc(titulo)}</b><p>${esc(texto)} Os donos já sabem o que falta.</p>${souAdminAqui()
    ? `<span class="vc-ativacao-adm">Para quem administra: ${secundario('Ver o que falta', `data-vc-falta aria-expanded="${estado.verFalta}"`)}</span>${estado.verFalta
      ? `<small class="vc-ativacao-tec">Falta aplicar a migração <code>${esc(estado.servidor?.migracao || '2026-11-07-carteira.sql')}</code> no banco. Depois disso, esta parte aparece sozinha.</small>` : ''}` : ''}</div>`;
  // Dica no ⓘ (a mesma peça do vbResumoHtml): a explicação longa sai do rodapé e fica ao passar o mouse.
  const dicaHtml = (texto) => `<span class="ar-dica vb-jogo-dica" tabindex="0" data-dica="${esc(texto)}" aria-label="${esc(texto)}"><span class="ar-dica-i" aria-hidden="true">i</span></span>`;
  // Uma linha de números (vbResumoHtml, vybe-core.js; redesign, quadro 18): zero e "sem dado" ficam discretos.
  function resumo(itens) {
    if (typeof vbResumoHtml === 'function') return `<div class="vc-resumo">${vbResumoHtml(itens)}</div>`;
    return `<div class="vc-resumo"><div class="vb-resumo">${itens.filter(Boolean).map((x) => `<span class="vb-resumo-item ${x.tom || ''}"${x.espiar ? ` data-espiar="${esc(x.espiar)}" role="button" tabindex="0"` : ''}>${x.valor !== '' ? `<b>${esc(x.valor)}</b>` : ''}${esc(x.rotulo)}</span>`).join('')}</div></div>`;
  }
  // n = o número cru (null = sem dado), texto = ele formatado, rótulo depois do número; a variação vai no fim do texto.
  function numero(n, texto, rotulo, { v = null, formato = (x) => x, contra = comparacao(), tom = '', espiar = '', dica = '', semDado = '' } = {}) {
    if (n == null) return { valor: '', rotulo: semDado || `${rotulo.trim()}: sem dado`, tom: 'zero', dica };
    const mudou = v && v.direcao !== 'igual' ? ` · ${v.direcao === 'sobe' ? '↑' : '↓'} ${formato(Math.abs(v.delta))} ${contra}` : '';
    const ab = espiar ? (espiar.startsWith('financas:') ? espiar : `carteira:${espiar}`) : '';
    return { valor: texto, rotulo: rotulo + mudou, tom: tom || (Number(n) ? '' : 'zero'), espiar: ab, dica };
  }
  const comparacao = () => (estado.tipo === 'anual' ? 'vs ano anterior' : 'vs mês anterior');
  function ordemHtml(lista, opcoes) {
    return `<label class="vc-ordem"><span>Ordem</span><select data-vc-ordem="${lista}">${opcoes.map(([v, r]) => `<option value="${v}"${estado.ordem[lista] === v ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>`;
  }
  function verMais(lista, total) {
    const lim = estado.limite[lista] || PAGINA;
    return total > lim ? `<button type="button" class="vc-mais" data-vc-mais="${lista}">Ver mais (${total - lim})</button>` : '';
  }
  const cortar = (lista, nome) => lista.slice(0, estado.limite[nome] || PAGINA);
  const nota = (texto) => `<p class="vc-nota">${esc(texto)}</p>`;

  // Meta da nota da carteira (14/11/2026, vybe_carteira_config 'meta_carteira', GET/POST /api/painel?area=metas): os donos
  // definem; vira a linha tracejada. Sem meta gravada, a tracejada é a de sempre (o limite do risco médio).
  let metas = null, metasLendo = null;
  function lerMetas() {
    if (metas || metasLendo || typeof fetch !== 'function') return metas;
    metasLendo = fetch('/api/painel?area=metas', { credentials: 'same-origin', cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
      .then((j) => { metas = j || {}; if (j?.carteira_nota != null) pintar(); }).catch(() => { metas = {}; }).finally(() => { metasLendo = null; });
    return null;
  }
  const metaNota = () => { lerMetas(); const m = Number(metas?.carteira_nota); return Number.isFinite(m) && m > 0 ? m : null; };
  function metaSub() {
    const m = metaNota();
    if (estado.metaEditar && metas?.pode_editar) return ` · <span class="d3c-meta-ed"><input type="number" min="1" max="100" step="1" inputmode="numeric" value="${m ?? ''}" aria-label="Meta da nota média (1 a 100)" data-vc-meta-campo><button type="button" class="v2c-link" data-vc-meta-salvar>Salvar</button></span>`;
    if (metas?.pode_editar) return ` · <button type="button" class="v2c-link" data-vc-meta>${m != null ? `meta ${m}` : 'definir meta'}</button>`;
    return m != null ? ` · meta ${m}` : '';
  }
  // ---------- Saúde ----------
  function serieHtml(h) {
    if (!estado.servidor?.historico?.disponivel) return nota('A média mês a mês começa a ser guardada quando a Carteira for ativada no banco.');
    if (h.serie.length < 2) return nota('A média mês a mês aparece a partir do segundo mês guardado.');
    // Direção 3: gráfico sempre em linha, com a meta de risco médio tracejada e os meses embaixo.
    const rotulo = `Média da carteira: ${h.serie.map((m) => `${m.mes.slice(5, 7)}/${m.mes.slice(2, 4)} ${m.media}`).join(', ')}`;
    return `<div class="d3c-serie">${d3Linha(h.serie.map((m) => m.media), { meta: metaNota() ?? S().REGRAS?.riscoMedio ?? null, largura: 560, altura: 120, rotulo })}
      <div class="d3c-meses" aria-hidden="true">${h.serie.map((m) => `<span${m.agora ? ' class="agora"' : ''}><b>${m.media}</b>${m.mes.slice(5, 7)}/${m.mes.slice(2, 4)}</span>`).join('')}</div></div>`;
  }
  // ===== Saúde da carteira e Onboarding pelos quadros do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
  // As duas telas são os quadros, nesta ordem: título com a visão e a ajuda; a fala do Mateus; três números; uma
  // barra de filtro; a lista em que a linha abre no lugar. Saíram do alto, porque o quadro não tem, e continuam a um
  // clique: a média mês a mês e as contas por head ("Mês a mês"), a ordem e o head ("Filtros" e "mudar a ordem"),
  // a explicação da nota ("Como a nota é feita"), os encerrados e o editor de etapas ("Filtros" do Onboarding).
  const TELAS_DO_QUADRO = new Set(['saude', 'onboarding', 'churn', 'contratos']);
  const AGENTE = { nome: 'Mateus', papel: 'Atendimento ao cliente' };
  // "Precisam de você": risco alto ou nota abaixo de 52 (o corte do quadro). A queda semana a semana não entra
  // porque o histórico guarda só a média do mês, não a nota de cada cliente.
  const LIMITE_PRECISA = 52, PAGINA_QUADRO = 5, DIAS_PARADO = 5;
  const precisaDeVoce = (c) => c.risco === 'alto' || c.score < LIMITE_PRECISA;
  const TOM_DO_RISCO = { alto: 'r', medio: 'a', baixo: 'g' };
  const COR_DO_RISCO = { alto: '#B42318', medio: '#E0A21B', baixo: '#11613A' };
  const duasLetras = (nome) => String(nome || '?').trim().slice(0, 2).toUpperCase();
  const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0] || '';
  const avatarHtml = (nome) => `<span class="v2c-av" aria-hidden="true">${esc(duasLetras(nome))}</span>`;
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const SETA = '<svg class="v2c-seta" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const falaHtml = (frase, botao = '') => `<section class="v2c-card v2c-fala" aria-label="${AGENTE.nome}, ${AGENTE.papel}"><span class="v2c-ag" aria-hidden="true">${AGENTE.nome[0]}</span><p><span class="v2c-quem">${AGENTE.nome} · ${AGENTE.papel}</span>${frase}</p>${botao}</section>`;
  const kpiHtml = ({ rotulo, valor, sub = '', extra = '', tom = '', atraso = 0 }) => `<div class="v2c-card v2c-kpi${tom ? ` ${tom}` : ''}"><small>${esc(rotulo)}</small><b><span class="v2-num"${atraso ? ` style="animation-delay:${atraso}s"` : ''}>${esc(valor)}</span>${extra}</b>${sub}</div>`;
  const botao = (rotulo, attrs, cls = '') => `<button type="button" class="v2c-btn${cls ? ` ${cls}` : ''}" ${attrs}>${esc(rotulo)}</button>`;
  const ficha = (rotulo, n, attrs, ligada) => `<button type="button" class="v2c-chip" aria-pressed="${Boolean(ligada)}" ${attrs}>${rotulo}${n == null ? '' : ` <b>${n}</b>`}</button>`;
  const ligacao = (rotulo, attrs) => `<button type="button" class="v2c-link" ${attrs}>${esc(rotulo)}</button>`;
  const FECHAR = '<button type="button" class="v2c-x" data-vc-fechar aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>';
  // O que tirou ponto, pelo nome que a equipe usa, e a cor de cada perda na barra (vermelho só no que venceu).
  const CAUSAS = [[/veiculação vencida/, 'atraso de veiculação'], [/prazo interno vencido/, 'prazo interno vencido'], [/risco de furo/, 'risco de furo'], [/altera/, 'peça voltando para alteração'],
    [/aprova/, 'aprovação parada'], [/sem conteúdo|posts nesta semana/, 'calendário abaixo da meta'], [/entregas no prazo/, 'entrega fora do prazo'], [/contrato/, 'fim de contrato'],
    [/pagamento/, 'pagamento em atraso'], [/NPS/, 'NPS baixo'], [/reunião/, 'falta de reunião'], [/^grupo:/, 'clima do grupo']];
  const causaDe = (m) => (CAUSAS.find(([re]) => re.test(m.texto)) || [null, 'outros sinais'])[1];
  const corDaPerda = (m) => (/vencid|furo/.test(m.texto) ? '#B42318' : /altera/.test(m.texto) ? '#E0A21B' : '#6B665E');
  const motivoCurto = (t) => String(t).replace(/^(\d+) (peças?) com a veiculação (vencida)$/, (_, n, p, v) => `${n} ${p} ${Number(n) === 1 ? v : `${v}s`}`).replace(/^(\d+) peças? em alteração agora$/, '$1 em alteração');
  const ruinsDe = (c) => c.motivos.filter((m) => m.tom === 'ruim');
  const ROTULO_DA_ORDEM = { risco: 'pior nota primeiro', melhor: 'melhor nota primeiro', nome: 'por nome' };
  const TITULO_DO_FILTRO = { precisam: 'Quem precisa de você, e por quê', todos: 'Todos os clientes, e por quê', alto: 'Risco alto, e por quê', medio: 'Risco médio, e por quê', baixo: 'Risco baixo, e por quê' };

  // Direção 3 (moodboard 3, 13/11/2026): o bloco de ação laranja, o cartão de número e a mini linha vêm de vybe-core.js.
  const d3Acao = (o) => (typeof d3AcaoHtml === 'function' ? d3AcaoHtml(o) : '');
  const d3Linha = (v, o) => (typeof d3LinhaSvg === 'function' ? d3LinhaSvg(v, o) : '');
  // Cartão de número da Direção 3: rótulo, o número que chega, a mini linha ao lado e uma linha curta embaixo.
  // Com attrs vira botão: o cartão filtra a lista.
  function numD3({ rotulo, valor, de = '', tom = '', linha = '', sub = '', attrs = '' }) {
    const tag = attrs ? 'button' : 'div';
    return `<${tag}${attrs ? ` type="button" ${attrs}` : ''} class="d3-num d3c-num${tom ? ` ${tom}` : ''}"><span class="d3-num-rot">${esc(rotulo)}</span><b class="d3-num-v">${valor}${de ? `<small>${esc(de)}</small>` : ''}</b>${linha}${sub ? `<span class="d3c-sub">${sub}</span>` : ''}</${tag}>`;
  }
  const quemD3 = (ag) => `<small class="d3c-quem">${esc(ag.nome)} · ${esc(String(ag.papel).split(' ')[0])}</small>`;
  const pontoD3 = (tom) => `<i class="d3c-ponto ${tom}" aria-hidden="true"></i>`;
  // O que tirou ponto em 1 a 3 palavras ("5 vencidas", "3 alteração", "1/3 posts"); o texto inteiro fica na linha aberta.
  function perdaCurta(m, c) {
    const t = String(m.texto || ''); let x;
    if (/vencid/.test(t) && /^\d/.test(t)) { const n = c.numeros?.atrasadas || Number(t.match(/^\d+/)[0]); return n === 1 ? '1 vencida' : `${n} vencidas`; }
    if ((x = t.match(/^(\d+) peças? com risco de furo/))) return Number(x[1]) === 1 ? '1 risco de furo' : `${x[1]} riscos de furo`;
    if ((x = t.match(/^(\d+) (?:voltas?|peças?) (?:para|em) alteração/))) return Number(x[1]) === 1 ? '1 alteração' : `${x[1]} alterações`;
    if ((x = t.match(/^(\d+\/\d+) posts/))) return `${x[1]} posts`;
    if ((x = t.match(/^aprovação parada há (\d+) dias/))) return `aprovação ${x[1]} d`;
    if ((x = t.match(/leva (\d+) dias para aprovar/))) return `aprova em ${x[1]} d`;
    if ((x = t.match(/^(\d+)% das entregas/))) return `${x[1]}% no prazo`;
    if (/^sem conteúdo/.test(t)) return 'sem calendário';
    return t;
  }
  const ehVencida = (m) => /vencid/.test(m.texto);
  // O teto de cada sinal (auditoria 15/11, item 33): 5 e 12 vencidas tiram os mesmos −35 porque o atraso para no teto.
  const tetoDa = (m) => { const R = S()?.REGRAS || {}, k = causaDe(m);
    return k === 'atraso de veiculação' || k === 'prazo interno vencido' ? R.tetoAtraso : k === 'risco de furo' ? R.tetoRisco
      : k === 'peça voltando para alteração' ? R.tetoAjuste : k === 'entrega fora do prazo' ? R.tetoPrazo : null; };
  const noTeto = (m) => { const t = tetoDa(m); return t != null && -m.pontos >= t; };
  // A linha do cliente (quadro D3-Carteira): faixa do risco, nota, cliente, head, risco, o que tirou ponto e a ação.
  // Abre no lugar com cada perda por inteiro.
  function linhaCliente(c, casa = null) {
    const chave = `c:${c.nome}`, aberto = estado.abertos.has(chave), tempo = c.id && casa ? casa.get(c.id) : null;
    const ruins = ruinsDe(c), bons = c.motivos.filter((m) => m.tom !== 'ruim'), perdeu = ruins.reduce((t, m) => t - m.pontos, 0);
    const vencidas = c.numeros?.atrasadas || 0, tom = TOM_DO_RISCO[c.risco] || 'a';
    const perdas = ruins.length ? ruins.slice(0, 3).map((m) => `<span class="${ehVencida(m) ? 'r' : ''}"${noTeto(m) ? ` title="${esc(`O teto deste sinal é −${tetoDa(m)}: mais peças não tiram mais ponto`)}"` : ''}><b>−${-m.pontos}</b> · ${esc(perdaCurta(m, c))}</span>`).join('')
      : `<span class="g">${esc(bons[0]?.texto || 'sem sinal de alerta')}</span>`;
    const head = c.heads.length ? `${avatarHtml(c.heads[0])}<span>${esc(primeiroNome(c.heads[0]))}${c.heads.length > 1 ? ` +${c.heads.length - 1}` : ''}</span>` : '<span class="d3c-vago">sem head</span>';
    return `<li class="v2-abre v2c-linha" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><i class="d3c-faixa ${tom}" aria-hidden="true"></i><div class="v2c-lin">
        <button type="button" class="v2c-abrir" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${c.nome}, nota ${c.score}, ${c.rotuloRisco}${perdeu ? `, perdeu ${perdeu} pontos` : ''}`)}">
          <span class="v2c-nota ${tom}">${c.score}</span>
          <span class="v2c-quemc"><b>${cliCor(c.nome)}</b></span>
          <span class="d3c-head">${head}</span>
          <span class="d3c-risco"><span class="d3c-pill">${pontoD3(tom)}${esc(String(c.rotuloRisco || '').replace(/^Risco /, '').replace(/^./, (l) => l.toUpperCase()))}</span></span>
          <span class="d3c-perdas">${perdas}</span>
          ${SETA}</button>
        <span class="v2c-ac">${botao(vencidas > 1 ? `Abrir as ${vencidas}` : vencidas === 1 ? 'Abrir a peça' : 'Abrir o cliente', `data-vc-cliente="${esc(c.nome)}"`)}</span></div>
      <div class="v2-mais"><div><div class="v2c-det">
        ${ruins.map((m) => `<p class="v2c-mot" style="--c:${corDaPerda(m)}"><b>−${-m.pontos}</b>${esc(m.texto)}${noTeto(m) ? ` (no teto de −${tetoDa(m)})` : ''}</p>`).join('')}
        ${bons.map((m) => `<p class="v2c-mot" style="--c:#11613A"><b>ok</b>${esc(m.texto)}</p>`).join('')}
        <p class="v2c-mot v2c-mot-nota">Head: ${esc(c.heads.join(', ') || 'sem head')}${c.carteira ? ` · Carteira: ${esc(c.carteira)}` : ''}${tempo ? ` · ${esc(casaTxt(tempo))}${tempo.temContrato ? ` · ${esc(contratoTxt(tempo))}` : ' · sem contrato registrado'}` : ''}</p>
      </div></div></div></li>`;
  }
  // Mini painel dos números: a última leitura de cada aba fica aqui para o painel listar quem está no número.
  const espiarCarteira = {};
  (window.VybeEspiarProvedores = window.VybeEspiarProvedores || {}).carteira = (resto) => {
    const [tipo, k] = String(resto).split(':');
    if (tipo === 'risco' && espiarCarteira.saude) {
      const nome = { alto: 'Risco alto', medio: 'Risco médio', baixo: 'Risco baixo' }[k], cls = { alto: 'u1', medio: 'u2', baixo: 'u6' }[k];
      const itens = espiarCarteira.saude.clientes.filter((c) => c.risco === k).map((c) => ({ nome: c.nome, sub: (() => { const m = c.motivos || [], ruins = m.filter((x) => x.tom === 'ruim'); return (ruins.length ? ruins : m).slice(0, 2).map((x) => x.texto).join(' · '); })(), dir: c.score != null ? String(c.score) : '', cls }));
      return { titulo: nome, cls, itens, vazio: 'Nenhum cliente neste risco.', rodape: 'Clique para filtrar a lista', clicar: () => { estado.risco = k; pintar(); } };
    }
    if (tipo === 'contratos' && espiarCarteira.contratos) {
      const r = espiarCarteira.contratos;
      const linhas = k === 'breve' ? [...r.vencidas, ...r.emBreve] : r.linhas.filter((l) => !l.temContrato);
      const itens = linhas.map((l) => ({ nome: l.nome, sub: l.renovacao ? (l.vencida ? 'renovação vencida em ' : 'renova em ') + dataCurta(l.renovacao) : 'sem contrato registrado', dir: l.valor != null ? reais(l.valor) + '/mês' : '', cls: l.vencida ? 'u1' : '' }));
      if (k === 'breve' || k === 'sem') return { titulo: k === 'breve' ? 'Renovações vencidas e em 30 dias' : 'Clientes sem contrato', cls: k === 'breve' ? 'u2' : '', itens, vazio: 'Nenhum.' };
    }
    // Tempo restante até a renovação (contratos abertos que ainda não venceram).
    if (tipo === 'contratos' && k === 'restante' && espiarCarteira.contratos) {
      const linhas = espiarCarteira.contratos.linhas.filter((l) => l.diasRestantes != null).sort((a, b) => a.diasRestantes - b.diasRestantes);
      return { titulo: 'Tempo até a renovação', itens: linhas.map((l) => ({ nome: l.nome, sub: `renova em ${dataCurta(l.renovacao)}`, dir: restanteTxt(l.diasRestantes), cls: l.emBreve ? 'u2' : '' })),
        vazio: 'Nenhum contrato aberto com renovação marcada.', rodape: 'Média = soma dos dias até a renovação ÷ contratos' };
    }
    // LTV: meses de casa e receita estimada (valor mensal × meses), de quem é ativo hoje.
    if (tipo === 'ltv' && espiarCarteira.contratos) {
      const r = espiarCarteira.contratos;
      if (k === 'receita') {
        const linhas = r.linhas.filter((l) => l.receitaLtv != null).sort((a, b) => b.receitaLtv - a.receitaLtv);
        return { titulo: 'Receita estimada do LTV', itens: linhas.map((l) => ({ nome: l.nome, sub: `${reais(l.valor)}/mês × ${mesesTxt(l.mesesLtv)}`, dir: reais(l.receitaLtv) })),
          vazio: 'Nenhum cliente com valor e data de entrada.', rodape: r.semReceitaLtv ? `${plural(r.semReceitaLtv, 'cliente fica', 'clientes ficam')} de fora (sem valor ou sem data)` : '' };
      }
      const linhas = r.linhas.filter((l) => l.mesesLtv != null).sort((a, b) => b.mesesLtv - a.mesesLtv);
      return { titulo: 'Tempo de casa (LTV)', itens: linhas.map((l) => ({ nome: l.nome, sub: `desde ${dataCurta(l.entrada)} · ${FONTE_ENTRADA[l.fonteEntrada] || 'entrada'}`, dir: mesesTxt(l.mesesLtv) })),
        vazio: 'Nenhum cliente com data de entrada.', rodape: r.semDataLtv ? `${plural(r.semDataLtv, 'cliente sem data fica', 'clientes sem data ficam')} fora da média` : '' };
    }
    if (tipo === 'novos' && espiarCarteira.contratos) {
      const r = espiarCarteira.contratos;
      return { titulo: `Clientes novos em ${r.periodo.rotulo}`, cls: 'u6',
        itens: r.novos.map((n) => ({ nome: n.nome, sub: `entrou em ${dataCurta(n.entrada)} · ${FONTE_ENTRADA[n.fonteEntrada] || 'entrada'}${n.ativo ? '' : ` · saiu em ${dataCurta(n.saida)}`}`, dir: n.ativo ? '' : 'saiu', cls: n.ativo ? '' : 'u1' })),
        vazio: 'Ninguém entrou neste período.' };
    }
    // Barras do mês a mês: quem entrou ou saiu naquele mês (carteira:mes:novos:AAAA-MM).
    if (tipo === 'mes' && espiarCarteira.base) {
      const [, qual, ym] = String(resto).split(':');
      const ct = new Map((espiarCarteira.listaContratos || []).map((c) => [String(c.cliente_id), c]));
      const lista = espiarCarteira.base.map((c) => ({ c, e: S().util.entradaDe(c, ct.get(String(c.id)) || null).entrada }))
        .filter(({ c, e }) => (qual === 'saidas' ? String(c.saida || '').startsWith(ym) : String(e || '').startsWith(ym)))
        .sort((a, b) => String(qual === 'saidas' ? a.c.saida : a.e).localeCompare(String(qual === 'saidas' ? b.c.saida : b.e)));
      return { titulo: `${qual === 'saidas' ? 'Saíram' : 'Entraram'} em ${S().util.nomeDoMes(ym)}`, cls: qual === 'saidas' ? 'u1' : 'u6',
        itens: lista.map(({ c, e }) => ({ nome: c.nome, sub: qual === 'saidas' ? `saiu em ${dataCurta(c.saida)}` : `entrou em ${dataCurta(e)}`, dir: c.valor != null ? `${reais(c.valor)}/mês` : '' })), vazio: 'Ninguém.' };
    }
    // Contas por head (carteira:head:<posição na lista>).
    if (tipo === 'head' && espiarCarteira.heads) {
      const h = espiarCarteira.heads[Number(k)];
      if (!h) return null;
      return { titulo: `Contas de ${h.head}`, cls: h.nivel, itens: h.clientes.map((c) => ({ nome: c.nome, sub: RISCO_TXT[c.risco] || '', dir: String(c.score), cls: c.nivel })),
        vazio: 'Nenhum cliente.', rodape: 'Clique para filtrar a lista pelo head', clicar: () => { estado.head = h.head; estado.risco = 'todos'; pintar(); } };
    }
    return null;
  };
  // A fala do Mateus: a nota, a causa que mais tira ponto da carteira e para onde a média vai sem ela.
  function falaDaSaude(r) {
    const soma = new Map();
    for (const c of r.clientes) for (const m of ruinsDe(c)) { const k = causaDe(m), x = soma.get(k) || { pontos: 0, clientes: new Set() }; x.pontos -= m.pontos; x.clientes.add(c); soma.set(k, x); }
    const [causa, x] = [...soma.entries()].sort((a, b) => b[1].pontos - a[1].pontos)[0] || [];
    // Direção 3: a fala vira o bloco de ação laranja, numa frase só, com o botão que leva ao que pesa.
    const media = r.resumo.media;
    // Sem nada tirando ponto não há ação: a frase fica neutra, no cartão branco (regra D3: laranja = ação).
    if (!causa) return falaHtml(`Carteira em <b>${esc(media)}</b> · ninguém perdeu ponto.`);
    const n = x.clientes.size, deAtraso = causa === 'atraso de veiculação' || causa === 'prazo interno vencido', vencidas = deAtraso ? [...x.clientes].reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0) : 0;
    const semEla = Math.round(r.clientes.reduce((t, c) => t + Math.min(100, c.score + ruinsDe(c).filter((m) => causaDe(m) === causa).reduce((s, m) => s - m.pontos, 0)), 0) / r.clientes.length);
    if (deAtraso && vencidas) {
      return d3Acao({ frase: `${plural(vencidas, 'vencida', 'vencidas')} em ${plural(n, 'cliente', 'clientes')} · ${vencidas === 1 ? 'resolvida' : 'resolvidas'}, a nota vai de ${esc(media)} a ${semEla}.`,
        agente: AGENTE.nome, botao: vencidas === 1 ? 'Ver a peça' : `Ver as ${vencidas}`, attrs: 'data-vc-atrasadas' });
    }
    return d3Acao({ frase: `${esc(causa.replace(/^./, (l) => l.toUpperCase()))} pesa em ${plural(n, 'cliente', 'clientes')} · resolvido, a nota vai de ${esc(media)} a ${semEla}.`,
      agente: AGENTE.nome, botao: n === 1 ? 'Ver o cliente' : `Ver os ${n}`, attrs: 'data-vc-risco="todos" data-vc-limpar' });
  }
  function abaSaude() {
    const r = estado.saude;
    if (!S() || !window.VybeDono) return { corpo: vazio('A conta da saúde não carregou nesta página.', acao('Atualizar a página', 'data-vc-atualizar')) };
    if (!r || !r.clientes.length) return { corpo: vazio(cadastro().length ? 'Nenhum cliente ativo com peças no painel ainda.' : 'O cadastro de clientes ainda não carregou.', acao('Carregar de novo', 'data-vc-recarregar')) };
    espiarCarteira.saude = r;
    const h = S().historicoSaude({ meses: estado.servidor?.historico?.meses || [], atual: r.resumo, hoje: r.dia });
    const headsDe = (c) => (c.heads.length ? c.heads : [S().SEM_HEAD]);
    const heads = [...new Set(r.clientes.flatMap(headsDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const noFiltro = { precisam: precisaDeVoce, todos: () => true }[estado.risco] || ((c) => c.risco === estado.risco);
    let lista = r.clientes.filter((c) => noFiltro(c) && (estado.head === 'todos' || headsDe(c).includes(estado.head)));
    if (estado.ordem.saude === 'melhor') lista = [...lista].reverse();
    else if (estado.ordem.saude === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Tempo de casa de cada cliente (para a linha aberta) e as contas por head com a receita (base do servidor).
    const ctr = contratosAgora();
    if (ctr) espiarCarteira.contratos = ctr;
    const casa = ctr ? new Map(ctr.linhas.map((l) => [l.id, l])) : null;
    const contas = S().contasPorHead({ clientes: r.clientes, base: estado.servidor?.clientes || [], contratos: listaContratos() });
    espiarCarteira.heads = contas;
    const fonte = r.fonte.sinais === 'servidor' ? 'Alteração e aprovação pelo histórico de status (30 e 60 dias).' : 'Alteração e aprovação pelo que está na tela agora (o histórico do servidor não respondeu).';
    // Direção 3: no título, quantos ativos e a hora da leitura; Agora / Mês a mês e "Como a nota é feita" à direita.
    const agoraHora = new Date().toTimeString().slice(0, 5);
    const topo = `<span class="d3c-meta">${plural(r.clientes.length, 'ativo', 'ativos')} · ${agoraHora}</span><span class="v2c-seg" role="group" aria-label="Visão">${[['agora', 'Agora'], ['meses', 'Mês a mês']].map(([k, rot]) => `<button type="button" data-vc-visao="${k}" aria-pressed="${estado.visao === k}">${rot}</button>`).join('')}</span>
      ${botao('Como a nota é feita', `data-vc-ajuda aria-expanded="${estado.ajuda}"`, 'g')}`;
    const ajuda = estado.ajuda ? `<div class="v2c-card v2c-ajuda">${AJUDA}${nota(fonte)}</div>` : '';
    // "Mês a mês": o que saiu do alto da tela (a média guardada de cada mês e as contas por head).
    if (estado.visao === 'meses') {
      return { topo, corpo: `${ajuda}<section class="v2c-card"><div class="v2c-card-topo"><h2>Média mês a mês</h2></div>${serieHtml(h)}</section>
        ${contas.length ? `<div class="v2c-card v2c-contas">${contasHtml(contas)}</div>` : ''}` };
    }
    // Três grupos que somam o total (auditoria 15/11, item 33): precisam de você (risco alto ou nota abaixo de 52), em atenção
    // (o resto do risco médio) e tranquilos = risco baixo (nota 75 ou mais), o mesmo número do filtro "Risco baixo".
    const precisam = r.clientes.filter(precisaDeVoce), tranquilos = r.clientes.filter((c) => c.risco === 'baixo'), foraDaLista = r.clientes.filter((c) => !precisaDeVoce(c));
    const v = h.variacao.media, mudou = v && v.direcao !== 'igual' && v.anterior != null ? `${v.direcao === 'sobe' ? 'subiu' : 'caiu'} ${Math.abs(v.delta)} no mês` : '';
    const riscoDaMedia = S().riscoDaNota(r.resumo.media ?? 0);
    const vencidasTotal = r.clientes.reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0), vencidasBaixo = precisam.reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0);
    // A média guardada dia a dia (server/series-historicas.js, série saude_media); com menos de 2 dias, a média mês a mês.
    const diaria = typeof d3Series === 'function' && typeof d3SerieValores === 'function' ? d3SerieValores(d3Series('carteira', () => pintar())?.media) : null;
    const serieMedia = diaria || (h.serie || []).map((m) => m.media);
    // Quatro números do quadro D3: nota média com a linha mês a mês, quem precisa de você, os tranquilos e as peças vencidas.
    const numeros = `<div class="v2c-tres d3c-quatro">
        ${numD3({ rotulo: 'Nota média', valor: esc(r.resumo.media ?? '—'), de: ' / 100', tom: TOM_DO_RISCO[riscoDaMedia] || 'a', linha: d3Linha(serieMedia, { meta: metaNota(), largura: 90, altura: 28, rotulo: diaria ? `Nota média dia a dia, ${diaria.length} dias` : 'Nota média mês a mês' }),
          sub: `${plural(r.clientes.length, 'ativo', 'ativos')}${mudou ? ` · ${mudou}` : ''}${metaSub()}` })}
        ${numD3({ rotulo: 'Precisam de você', valor: precisam.length, de: ` / ${r.clientes.length}`, sub: `risco alto ou nota &lt; ${LIMITE_PRECISA}`, attrs: `data-vc-risco="precisam" aria-pressed="${estado.risco === 'precisam'}"` })}
        ${numD3({ rotulo: 'Tranquilos', valor: tranquilos.length, de: ` / ${r.clientes.length}`, attrs: `data-vc-risco="baixo" aria-pressed="${estado.risco === 'baixo'}"`,
          sub: `${[...tranquilos].sort((a, b) => b.score - a.score).slice(0, 3).map((c) => `<span class="d3c-mini ${TOM_DO_RISCO[c.risco] || 'a'}" title="${esc(c.nome)}">${c.score}</span>`).join('')}${tranquilos.length ? `risco baixo · nota ${S().REGRAS?.riscoMedio ?? 75} ou mais` : `ninguém com nota ${S().REGRAS?.riscoMedio ?? 75} ou mais`}` })}
        ${numD3({ rotulo: 'Peças vencidas', valor: vencidasTotal, tom: vencidasTotal ? 'r' : '', attrs: vencidasTotal ? 'data-vc-atrasadas' : '',
          sub: vencidasTotal && precisam.length ? `<span class="d3c-r">${vencidasBaixo} nos ${precisam.length} de baixo</span>` : '' })}
      </div>`;
    const conta = (k) => (k === 'precisam' ? precisam.length : k === 'todos' ? r.clientes.length : r.resumo[k]);
    const filtros = `<div class="v2c-filtros">
        <span class="v2c-chips" role="group" aria-label="Filtrar por risco">${[['precisam', 'Precisam de você'], ['todos', 'Todos'], ['alto', 'Risco alto'], ['medio', 'Risco médio'], ['baixo', 'Risco baixo']].map(([k, rot]) => ficha(`${TOM_DO_RISCO[k] ? pontoD3(TOM_DO_RISCO[k]) : ''}${rot}`, conta(k), `data-vc-risco="${k}"`, estado.risco === k)).join('')}</span>
        <span class="v2c-espaco"></span>
        <label class="d3c-sel"><span>Head:</span><select data-vc-head aria-label="Filtrar por head"><option value="todos">todos</option>${heads.map((x) => `<option${estado.head === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        ${botao('Filtros', `data-vc-filtros aria-expanded="${estado.filtros}"`)}
      </div>${estado.filtros ? `<div class="v2c-card v2c-painel">${ordemHtml('saude', [['risco', 'Pior nota primeiro'], ['melhor', 'Melhor nota primeiro'], ['nome', 'Nome A–Z']])}</div>` : ''}`;
    const limite = estado.limite.saude || PAGINA_QUADRO, resto = lista.length - limite;
    const semNinguem = estado.risco === 'precisam' && estado.head === 'todos' ? 'Ninguém precisa de você agora.' : 'Nenhum cliente neste filtro.';
    const cab = `<div class="d3c-cab" aria-hidden="true"><span>Nota</span><span>Cliente</span><span>Head</span><span>Risco</span><span>O que tirou ponto</span></div>`;
    const corpoLista = lista.length ? `${cab}<ol class="v2c-lista">${lista.slice(0, limite).map((c) => linhaCliente(c, casa)).join('')}</ol>`
      : `<div class="v2c-vazio"><p>${semNinguem}</p>${botao('Ver todos', 'data-vc-risco="todos" data-vc-limpar')}</div>`;
    // Rodapé: quanto cada sinal tira (as regras da nota) e o que ficou recolhido.
    const R = S().REGRAS || {};
    // Cada sinal com o teto (item 33): o atraso para em −35, a alteração em −16 (a primeira não conta), o risco em −9.
    const tira = [[R.furo, 'vencida', 'r', `Somando vencidas e prazo interno, o atraso tira no máximo ${R.tetoAtraso}`], [R.prazoVencido, 'prazo interno', '', `Somando vencidas e prazo interno, o atraso tira no máximo ${R.tetoAtraso}`],
      [R.ajuste, 'alteração', '', `A primeira não conta; tira no máximo ${R.tetoAjuste}`], [R.risco, 'risco de furo', '', `Tira no máximo ${R.tetoRisco}`], [R.abaixoDaMeta, 'posts da semana']].filter(([p]) => p);
    const recolhidos = estado.risco === 'precisam' ? foraDaLista.length : 0;
    const pe = `<div class="v2c-pe d3c-pe"><span class="d3c-pe-rot">Tira ponto</span>${tira.map(([p, rot, t, dica]) => `<span class="d3c-tira${t ? ` ${t}` : ''}"${dica ? ` title="${esc(dica)}"` : ''}>−${p} ${rot}</span>`).join('')}${R.tetoAtraso ? `<span class="d3c-tira" title="Por isso 5 e 12 vencidas tiram os mesmos ${R.tetoAtraso} pontos">atraso para em −${R.tetoAtraso}</span>` : ''}<span class="v2c-espaco"></span>
      ${resto > 0 ? botao(`+${plural(resto, 'cliente', 'clientes')}`, 'data-vc-mais="saude"') : ''}${recolhidos ? botao(`+${recolhidos} sem urgência`, 'data-vc-risco="todos"') : ''}</div>`;
    return { topo, corpo: `${ajuda}${falaDaSaude(r)}${numeros}${filtros}
      <section class="v2c-card v2c-quadro" aria-label="${esc(TITULO_DO_FILTRO[estado.risco] || TITULO_DO_FILTRO.todos)}"><button type="button" class="d3c-ordem" data-vc-ordem-gira title="Mudar a ordem">${ROTULO_DA_ORDEM[estado.ordem.saude] || ROTULO_DA_ORDEM.risco}</button>
        ${corpoLista}${pe}</section>` };
  }
  // ===== Saúde da carteira na prancha V2-R-Saude-Carteira (19/11/2026) =====
  // A janela vira vidro fumê, como Contratos e Churn (TELAS_M): o topo com Agora / Mês a mês, o head e o "Como funciona";
  // quatro números em folha; a folha da lista com os filtros na cabeça, a ordem e o pé "Mais"; e, ao lado, o laranja do
  // Mateus (o que mais tira ponto, numa frase), "O que mais pesa", "Como tira ponto" e "Abrir". Os mesmos data-vc-* de antes.
  const PESA_ROTULO = { 'atraso de veiculação': 'Veiculação vencida', 'prazo interno vencido': 'Prazo interno vencido', 'risco de furo': 'Risco de furo', 'peça voltando para alteração': 'Volta para alteração',
    'aprovação parada': 'Aprovação parada', 'calendário abaixo da meta': 'Menos posts que a meta', 'entrega fora do prazo': 'Entrega fora do prazo', 'fim de contrato': 'Fim de contrato',
    'pagamento em atraso': 'Pagamento em atraso', 'NPS baixo': 'NPS baixo', 'falta de reunião': 'Sem reunião', 'clima do grupo': 'Clima do grupo', 'outros sinais': 'Outros sinais' };
  const ICS = { linha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16l5-5 4 3 7-7"/><path d="M15 7h5v5"/></svg>', ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>' };
  function linhaSaudeM(c, casa) {
    const chave = `c:${c.nome}`, aberto = estado.abertos.has(chave), tempo = c.id && casa ? casa.get(c.id) : null;
    const ruins = ruinsDe(c), bons = c.motivos.filter((m) => m.tom !== 'ruim'), perdeu = ruins.reduce((t, m) => t - m.pontos, 0);
    const vencidas = c.numeros?.atrasadas || 0, tom = TOM_DO_RISCO[c.risco] || 'a';
    const perdas = ruins.length ? ruins.slice(0, 3).map((m) => `<span${noTeto(m) ? ` title="${esc(`O teto deste sinal é −${tetoDa(m)}: mais peças não tiram mais ponto`)}"` : ''}><b${ehVencida(m) ? ' class="r"' : ''}>−${-m.pontos}</b> · ${esc(perdaCurta(m, c))}</span>`).join('')
      : `<span class="g">${esc(bons[0]?.texto || 'sem sinal de alerta')}</span>`;
    const head = c.heads.length ? `<i class="d3m-r-sc-hav" aria-hidden="true">${esc(duasLetras(c.heads[0]))}</i><span>${esc(primeiroNome(c.heads[0]))}${c.heads.length > 1 ? ` +${c.heads.length - 1}` : ''}</span>` : '<span class="d3m-r-sc-vago">sem head</span>';
    const risco = String(c.rotuloRisco || '').replace(/^Risco /, '').replace(/^./, (l) => l.toUpperCase());
    const rodape = [c.heads.join(', ') || 'sem head', c.carteira ? `carteira ${c.carteira}` : '', tempo ? casaTxt(tempo) : '', tempo ? (tempo.temContrato ? contratoTxt(tempo) : 'sem contrato registrado') : ''].filter(Boolean).join(' · ');
    return `<li class="d3m-r-sc-li" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="d3m-r-sc-lin">
        <button type="button" class="d3m-r-sc-abre" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${c.nome}, nota ${c.score}, ${c.rotuloRisco}${perdeu ? `, perdeu ${perdeu} pontos` : ''}`)}">
          <b class="d3m-r-sc-nota ${tom}">${c.score}</b><span class="d3m-r-sc-cli">${avM(c.nome)}<b>${esc(c.nome)}</b></span><span class="d3m-r-sc-head">${head}</span>
          <span class="d3m-r-sc-risco"><i class="${tom}" aria-hidden="true"></i>${esc(risco)}</span><span class="d3m-r-sc-perdas">${perdas}</span></button>
        ${btnFolha(vencidas > 1 ? `Abrir as ${vencidas}` : vencidas === 1 ? 'Abrir a peça' : 'Abrir o cliente', `data-vc-cliente="${esc(c.nome)}"`)}</div>
      <div class="d3m-r-sc-det">${ruins.map((m) => `<span><b class="${ehVencida(m) ? 'r' : ''}">−${-m.pontos}</b><span>${esc(m.texto)}${noTeto(m) ? `, no teto de −${tetoDa(m)}` : ''}</span></span>`).join('')}
        ${bons.map((m) => `<span><b class="g">ok</b><span>${esc(m.texto)}</span></span>`).join('')}<small>${esc(rodape)}</small></div></li>`;
  }
  function abaSaudeM() {
    const r = estado.saude, agoraHora = new Date().toTimeString().slice(0, 5);
    const ajudaDe = (fonte) => `<div class="vc-ajuda" role="note"><b>Como a nota é feita</b><p>Cada cliente ativo começa com 100 e perde pontos por peça vencida, risco de furo, volta para alteração, aprovação parada, entrega fora do prazo, calendário abaixo da meta, contrato vencendo, pagamento atrasado, NPS baixo, muito tempo sem reunião e clima ruim no grupo. Abaixo de 50 é risco alto; de 50 a 74, médio.${fonte ? ` ${esc(fonte)}` : ''}</p></div>`;
    const casca = (main, lado = '') => `<div class="d3m-d-ct d3m-r-sc" data-tela="saude-v2"><div class="d3m-d-ct-main">${main}</div><aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${lado}</aside></div>`;
    if (!S() || !window.VybeDono) return { topo: { semTroca: true, sub: 'nota de 0 a 100' }, ajuda: ajudaDe(''), corpo: casca(`<section class="d3m-d-folha d3m-d-ct-folha so">${vazioM('A conta da saúde não carregou nesta página.', btnFolha('Atualizar a página', 'data-vc-atualizar', true))}</section>`) };
    if (!r || !r.clientes.length) return { topo: { semTroca: true, sub: 'nota de 0 a 100' }, ajuda: ajudaDe(''), corpo: casca(`<section class="d3m-d-folha d3m-d-ct-folha so">${vazioM(cadastro().length ? 'Nenhum cliente ativo com peças no painel ainda.' : 'O cadastro de clientes ainda não carregou.', btnFolha('Carregar de novo', 'data-vc-recarregar', true))}</section>`) };
    espiarCarteira.saude = r;
    const h = S().historicoSaude({ meses: estado.servidor?.historico?.meses || [], atual: r.resumo, hoje: r.dia });
    const headsDe = (c) => (c.heads.length ? c.heads : [S().SEM_HEAD]);
    const heads = [...new Set(r.clientes.flatMap(headsDe))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const ctr = contratosAgora();
    if (ctr) espiarCarteira.contratos = ctr;
    const casa = ctr ? new Map(ctr.linhas.map((l) => [l.id, l])) : null;
    const contas = S().contasPorHead({ clientes: r.clientes, base: estado.servidor?.clientes || [], contratos: listaContratos() });
    espiarCarteira.heads = contas;
    const fonte = r.fonte.sinais === 'servidor' ? 'Alteração e aprovação pelo histórico de status (30 e 60 dias).' : 'Alteração e aprovação pelo que está na tela agora (o histórico do servidor não respondeu).';
    const ferr = `<span class="d3m-d-seg" role="group" aria-label="Visão">${[['agora', 'Agora'], ['meses', 'Mês a mês']].map(([k, rot]) => `<button type="button" data-vc-visao="${k}" aria-pressed="${estado.visao === k}">${rot}</button>`).join('')}</span>
      <select class="d3m-d-sel" data-vc-head aria-label="Filtrar por head"><option value="todos">Head: todos</option>${heads.map((x) => `<option value="${esc(x)}"${estado.head === x ? ' selected' : ''}>Head: ${esc(x)}</option>`).join('')}</select>`;
    const mais = [['risco', 'Pior nota primeiro'], ['melhor', 'Melhor nota primeiro'], ['nome', 'Nome A–Z']].map(([k, rot]) => `<button type="button" role="menuitem" data-vc-ordem-saude="${k}"${estado.ordem.saude === k ? ' aria-current="true"' : ''}>${rot}</button>`);
    const topo = { semTroca: true, sub: `${plural(r.clientes.length, 'cliente ativo', 'clientes ativos')} · nota de 0 a 100 · lida às ${agoraHora}`, ferr, mais };
    const din = veDinheiro();
    const abrirM = `<nav class="d3m-cons d3m-d-ct-abrir" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div>
      <button type="button" class="d3m-vlin" data-vc-visao="${estado.visao === 'meses' ? 'agora' : 'meses'}" aria-pressed="${estado.visao === 'meses'}"><span><b>${estado.visao === 'meses' ? 'Clientes agora' : 'Contas por head'}</b> · ${estado.visao === 'meses' ? 'a lista de quem precisa de você' : `nota${din ? ' e receita' : ''}`}</span>${ICQ.seta}</button>
      <button type="button" class="d3m-vlin" data-vc-ir="churn"><span><b>Churn e contratos</b></span>${ICQ.seta}</button></nav>`;
    // "Mês a mês": a média guardada de cada mês e as contas por head, nas folhas.
    if (estado.visao === 'meses') {
      return { topo, ajuda: ajudaDe(fonte), corpo: casca(`<section class="d3m-d-folha d3m-d-ct-folha d3m-r-sc-meses" aria-label="Média mês a mês"><div class="d3m-d-cab"><h3>Média mês a mês</h3></div>${serieHtml(h)}</section>
        ${contas.length ? `<section class="d3m-d-folha d3m-d-ct-folha d3m-r-sc-contas" aria-label="Contas por head">${contasHtml(contas)}</section>` : ''}`, abrirM) };
    }
    const noFiltro = { precisam: precisaDeVoce, todos: () => true }[estado.risco] || ((c) => c.risco === estado.risco);
    let lista = r.clientes.filter((c) => noFiltro(c) && (estado.head === 'todos' || headsDe(c).includes(estado.head)));
    if (estado.ordem.saude === 'melhor') lista = [...lista].reverse();
    else if (estado.ordem.saude === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const precisam = r.clientes.filter(precisaDeVoce), tranquilos = r.clientes.filter((c) => c.risco === 'baixo');
    const v = h.variacao.media, mudou = v && v.direcao !== 'igual' && v.anterior != null ? `${v.direcao === 'sobe' ? 'subiu' : 'caiu'} ${Math.abs(v.delta)} no mês` : '';
    const riscoDaMedia = S().riscoDaNota(r.resumo.media ?? 0);
    const vencidasTotal = r.clientes.reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0), vencidasBaixo = precisam.reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0);
    const diaria = typeof d3Series === 'function' && typeof d3SerieValores === 'function' ? d3SerieValores(d3Series('carteira', () => pintar())?.media) : null;
    const serieMedia = diaria || (h.serie || []).map((m) => m.media);
    const corte = S().REGRAS?.riscoMedio ?? 75;
    const numeros = `<div class="d3m-d-nums d3m-r-sc-nums">
      ${numMq({ rotulo: 'Nota média', selo: 'tinta', ic: ICS.linha, valor: String(r.resumo.media ?? '—'), de: '/ 100', tom: TOM_DO_RISCO[riscoDaMedia] === 'r' ? 'r' : '', graf: miniMq(serieMedia), sub: `${mudou || plural(r.clientes.length, 'ativo', 'ativos')}${metaSub()}` })}
      ${numMq({ rotulo: 'Precisam de você', selo: precisam.length ? 'r' : '', ic: ICQ.alerta, valor: String(precisam.length), de: `/ ${r.clientes.length}`, sub: `risco alto ou nota abaixo de ${LIMITE_PRECISA}`, attrs: `data-vc-risco="precisam" aria-pressed="${estado.risco === 'precisam'}"` })}
      ${numMq({ rotulo: 'Tranquilos', selo: 'g', ic: ICS.ok, valor: String(tranquilos.length), de: `/ ${r.clientes.length}`, sub: tranquilos.length ? `risco baixo · nota ${corte} ou mais` : `ninguém com ${corte} ou mais`, attrs: `data-vc-risco="baixo" aria-pressed="${estado.risco === 'baixo'}"` })}
      ${numMq({ rotulo: 'Peças vencidas', selo: vencidasTotal ? 'r' : '', ic: ICQ.relogio, valor: String(vencidasTotal), tom: vencidasTotal ? 'r' : '', sub: vencidasTotal && precisam.length ? `${vencidasBaixo} nos ${precisam.length} de baixo` : vencidasTotal ? 'na carteira' : 'nenhuma peça vencida', attrs: vencidasTotal ? 'data-vc-atrasadas' : '' })}</div>`;
    const conta = (k) => (k === 'precisam' ? precisam.length : k === 'todos' ? r.clientes.length : r.resumo[k]);
    const FILTROS = [['precisam', 'Precisam de você'], ['todos', 'Todos'], ['alto', 'Risco alto'], ['medio', 'Risco médio'], ['baixo', 'Risco baixo']];
    const nomeFiltro = (FILTROS.find(([k]) => k === estado.risco) || FILTROS[1])[1];
    const limite = estado.limite.saude || 6, resto = lista.length - limite, recolhidos = estado.risco === 'precisam' ? r.clientes.length - precisam.length : 0;
    const semNinguem = estado.risco === 'precisam' && estado.head === 'todos' ? 'Ninguém precisa de você agora.' : 'Nenhum cliente neste filtro.';
    const cab = `<div class="d3m-r-sc-cab" aria-hidden="true"><span>Nota</span><span>Cliente</span><span>Head</span><span>Risco</span><span>O que tirou ponto</span><span></span></div>`;
    const pe = resto > 0 || recolhidos ? `<div class="d3m-r-sc-pe"><span>Mais</span>${resto > 0 ? `<button type="button" data-vc-mais="saude"><b>+${resto}</b><small>${resto === 1 ? 'cliente' : 'clientes'} neste filtro</small></button>` : ''}${recolhidos ? `<button type="button" data-vc-risco="todos"><b>+${recolhidos}</b><small>sem urgência, em Todos</small></button>` : ''}</div>` : '';
    const folhaLista = `<section class="d3m-d-folha d3m-d-ct-folha d3m-r-sc-folha" aria-label="${esc(TITULO_DO_FILTRO[estado.risco] || TITULO_DO_FILTRO.todos)}"><div class="d3m-d-cab"><h3>${esc(nomeFiltro)} <small>· ${lista.length} de ${r.clientes.length}</small></h3>
        ${segM('Filtrar por risco', FILTROS.map(([k, rot]) => [`data-vc-risco="${k}"`, rot, conta(k), estado.risco === k, k === 'alto' ? 'r' : '']))}
        <button type="button" class="d3m-d-elo d3m-r-sc-ordem" data-vc-ordem-gira title="Mudar a ordem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3"/></svg>${ROTULO_DA_ORDEM[estado.ordem.saude] || ROTULO_DA_ORDEM.risco}</button></div>
      ${lista.length ? `${cab}<ol class="d3m-r-sc-lista">${lista.slice(0, limite).map((c) => linhaSaudeM(c, casa)).join('')}</ol>` : vazioM(semNinguem, btnFolha('Ver todos', 'data-vc-risco="todos" data-vc-limpar'))}${pe}</section>`;
    // O lado: o laranja do Mateus com o que mais tira ponto (a mesma conta de falaDaSaude), o que pesa e as regras.
    const soma = new Map();
    for (const c of r.clientes) for (const m of ruinsDe(c)) { const k = causaDe(m), x = soma.get(k) || { pontos: 0, clientes: new Set() }; x.pontos -= m.pontos; x.clientes.add(c); soma.set(k, x); }
    const causas = [...soma.entries()].sort((a, b) => b[1].pontos - a[1].pontos);
    const [causa, x] = causas[0] || [], media = r.resumo.media;
    let laranja = '';
    if (causa) {
      const n = x.clientes.size, deAtraso = causa === 'atraso de veiculação' || causa === 'prazo interno vencido', vencidas = deAtraso ? [...x.clientes].reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0) : 0;
      const semEla = Math.round(r.clientes.reduce((t, c) => t + Math.min(100, c.score + ruinsDe(c).filter((m) => causaDe(m) === causa).reduce((s, m) => s - m.pontos, 0)), 0) / r.clientes.length);
      laranja = deAtraso && vencidas
        ? larMq(AGENTE, AGENTE.papel, vencidas, `${vencidas === 1 ? 'vencida' : 'vencidas'} em ${plural(n, 'cliente', 'clientes')}`, `${vencidas === 1 ? 'Resolvida' : 'Resolvidas'}, a nota média vai de ${esc(media)} para ${semEla}.`,
          `${btnLar(vencidas === 1 ? 'Ver a peça' : `Ver as ${vencidas}`, 'data-vc-atrasadas')}${btnLar('Ver por cliente', 'data-vc-risco="todos" data-vc-limpar', true)}`)
        : larMq(AGENTE, AGENTE.papel, n, `${n === 1 ? 'cliente' : 'clientes'} com ${esc(causa)}`, `Resolvido, a nota média vai de ${esc(media)} para ${semEla}.`,
          btnLar(n === 1 ? 'Ver o cliente' : `Ver os ${n}`, 'data-vc-risco="todos" data-vc-limpar'));
    }
    const pesa = causas.slice(0, 4);
    const pesaM = `<section class="d3m-cons" aria-label="O que mais pesa"><div class="d3m-cons-cab"><b>O que mais pesa</b><span>na carteira</span></div>${pesa.length
      ? `<div class="d3m-r-sc-pesa">${pesa.map(([k, y]) => `<span><span><span>${esc(PESA_ROTULO[k] || k)}</span><span>${plural(y.clientes.size, 'cliente', 'clientes')}</span></span><i style="--v:${Math.round((y.clientes.size / r.clientes.length) * 100)}%"></i></span>`).join('')}</div>`
      : '<p class="d3m-vvazio">Ninguém perdeu ponto.</p>'}</section>`;
    const R = S().REGRAS || {};
    const regra1 = [R.furo ? `−${R.furo} vencida` : '', R.prazoVencido ? `−${R.prazoVencido} prazo interno` : ''].filter(Boolean).join(' · ');
    const regra2 = [R.ajuste ? `−${R.ajuste} alteração` : '', R.risco ? `−${R.risco} risco de furo` : ''].filter(Boolean).join(' · ');
    const comoM = `<section class="d3m-cons" aria-label="Como tira ponto"><div class="d3m-cons-cab"><b>Como tira ponto</b><span>a nota começa em 100</span></div>
      ${regra1 ? `<button type="button" class="d3m-vlin" data-vc-como aria-expanded="${estado.ajuda}"><span><b>${esc(regra1)}</b>${R.tetoAtraso ? ` · teto −${R.tetoAtraso}` : ''}</span></button>` : ''}
      ${regra2 ? `<button type="button" class="d3m-vlin" data-vc-como aria-expanded="${estado.ajuda}"><span><b>${esc(regra2)}</b></span>${ICQ.seta}</button>` : ''}</section>`;
    return { topo, ajuda: ajudaDe(fonte), corpo: casca(`${numeros}${folhaLista}`, `${laranja}${pesaM}${comoM}${abrirM}`) };
  }
  // Contas por head: quantos clientes cada head tem, a nota média da carteira dele e a receita mensal.
  function contasHtml(contas) {
    if (!contas.length) return '';
    const semValor = contas.reduce((t, h) => t + (h.semHead ? 0 : h.semValor), 0);
    return `<section class="vc-secao"><div class="vc-secao-topo"><h3>Contas por head</h3><span class="vc-conta">${contas.filter((h) => !h.semHead).length}</span></div>
      <div class="vc-tabela-rola"><table class="vc-contas"><thead><tr><th scope="col">Head</th><th scope="col">Contas</th><th scope="col">Nota média</th><th scope="col">Risco alto</th><th scope="col">Receita/mês</th></tr></thead>
      <tbody>${contas.map((h, i) => `<tr${h.semHead ? ' class="sem-head"' : ''}><th scope="row">${esc(h.head)}</th>
        <td><span class="vc-num-espiar" data-espiar="carteira:head:${i}" role="button" tabindex="0" aria-label="${esc(`${plural(h.contas, 'conta', 'contas')} de ${h.head}`)}">${h.contas}</span></td>
        <td><span class="vc-nota-num ${h.nivel}">${h.media}</span></td>
        <td class="${h.alto ? 'vc-ruim' : ''}">${h.alto || '—'}</td>
        <td>${h.receita == null ? '—' : reais(h.receita)}</td></tr>`).join('')}</tbody></table></div>
      ${nota(`Cliente com mais de um head conta para cada um. Nota média = média simples das notas de saúde dos clientes do head.${semValor ? ` ${plural(semValor, 'conta sem valor mensal fica', 'contas sem valor mensal ficam')} fora da receita.` : ''}`)}</section>`;
  }

  // ---------- Onboarding ----------
  // Prancha V2-M-Onboarding (16/11/2026): o esqueleto dos módulos V2. À esquerda, as fichas das etapas (o clique filtra),
  // a folha dos clientes em entrada (o parado há mais tempo primeiro; a linha abre no lugar com o responsável e o
  // checklist de cada etapa) e a folha "Quanto cada etapa demora", com o pé "De olho". No vidro, o cartão laranja do
  // parado (ou de quem pede ação), o questionário do cliente em foco e "Abrir" (etapas, reuniões, como funciona e os
  // encerrados). O que vai ao servidor não mudou: onboarding_marcar, _responsavel, _iniciar, _encerrar e _reabrir.
  const podeOnboarding = (clienteId) => Boolean(estado.servidor?.pode?.onboarding_todos || estado.servidor?.meus_clientes?.includes(String(clienteId)));
  function nomeDaPessoa(id) { return (estado.servidor?.pessoas || []).find((p) => String(p.id) === String(id))?.nome || ''; }
  // A situação da linha, pelo que o servidor devolve: pronta para encerrar, parada, sem responsável ou andando.
  function situacaoDaLinha(o) {
    const s = o.situacao, d = s.atual?.dias_parada ?? 0;
    if (o.encerrado_em) return { tipo: 'encerrado', tom: 'n', texto: `Encerrado em ${dataCurta(diaDoCarimbo(o.encerrado_em))}` };
    if (s.concluido) return { tipo: 'pronto', tom: 'g', texto: 'Pronto para encerrar', pede: true };
    if (d > DIAS_PARADO) return { tipo: 'parado', tom: 'r', texto: `Parado · ${plural(d, 'dia', 'dias')}`, pede: true };
    if (!s.atual?.responsavel_id) return { tipo: 'sem-dono', tom: 'a', texto: 'Sem responsável', pede: true };
    return { tipo: 'andando', tom: 'g', texto: d ? `Andando · ${plural(d, 'dia', 'dias')}` : 'Andando' };
  }
  // Peças V2 da tela: botão de contorno na folha, botão do laranja, linha de consulta no vidro e a foto do cliente.
  const VAI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const btnOb = (rotulo, attrs) => `<button type="button" class="ob2-btn" ${attrs}>${esc(rotulo)}</button>`;
  const btnLar = (rotulo, attrs, segundo = false) => `<button type="button" class="d3m-btn l${segundo ? ' s' : ''}" ${attrs}>${esc(rotulo)}</button>`;
  const vlin = (forte, apoio, attrs, ponto = '') => `<button type="button" class="d3m-vlin" ${attrs}>${ponto ? `<i class="d3m-pt ${ponto}" aria-hidden="true"></i>` : ''}<span><b>${esc(forte)}</b>${apoio ? ` · ${esc(apoio)}` : ''}</span>${VAI}</button>`;
  const consulta = (titulo, lado, dentro) => `<section class="d3m-cons"><div class="d3m-cons-cab"><b>${esc(titulo)}</b><span>${esc(lado)}</span></div>${dentro}</section>`;
  function fotoCli(nome) {
    if (typeof fotoDoClienteCv2 === 'function') return fotoDoClienteCv2(nome);
    let h = 7; for (const ch of String(nome || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
    const p = String(nome || '?').trim().split(/\s+/);
    return `<i class="d3v-foto cv2-foto" style="--h:${h % 360}" aria-hidden="true">${esc((p.length > 1 ? p[0][0] + p[1][0] : p[0].slice(0, 2)).toUpperCase())}</i>`;
  }
  const segmentoDe = (id) => { const c = cadastro().find((x) => String(x.id) === String(id)); return c?.segmento || c?.cadastro?.segmento || ''; };
  const haDias = (d) => (d == null ? '—' : d === 0 ? 'hoje' : `há ${plural(d, 'dia', 'dias')}`);
  // A linha da folha: o grupo (só na primeira do grupo), a foto, o cliente, a trilha das etapas, a etapa de agora, há
  // quanto tempo está parada, o responsável e a ação. Aberta no lugar, cada etapa com o responsável e o checklist, e os
  // atalhos (kickoff, questionário, ficha e encerrar).
  function linhaOnboarding(o, etapas, grupo = '') {
    const s = o.situacao, sit = situacaoDaLinha(o), chave = `o:${o.cliente_id}`, aberto = estado.abertos.has(chave), pode = podeOnboarding(o.cliente_id) && !o.encerrado_em;
    const pessoas = estado.servidor?.pessoas || [], resp = s.atual?.responsavel_id ? nomeDaPessoa(s.atual.responsavel_id) : '';
    const parado = sit.tipo === 'parado', n = s.etapas.findIndex((e) => e.id === s.atual?.id) + 1;
    const trilha = `<span class="ob2-trilha" role="img" aria-label="${esc(s.concluido ? 'Todas as etapas feitas' : `Etapa ${n || 1} de ${s.etapas.length}`)}">${s.etapas.map((e) => `<i class="${e.concluida ? 'ok' : s.atual?.id === e.id ? `vez${parado ? ' r' : ''}` : ''}"></i>`).join('')}</span>`;
    const def = etapas.find((e) => e.id === s.atual?.id), feitos = o.etapas?.[def?.id]?.feitos || {}, faltam = (def?.itens || []).filter((i) => !feitos[i.id]);
    const etapa = o.encerrado_em ? '<span class="fv2-est">Encerrado</span>' : s.concluido ? '<span class="fv2-est g"><i aria-hidden="true"></i>Todas feitas</span>'
      : `<span class="fv2-est ${parado ? 'r' : 'a'}" title="${esc(faltam.length ? `Falta: ${faltam.map((i) => i.texto).join(' · ')}` : '')}"><i aria-hidden="true"></i>${esc(s.atual?.nome || '')}</span>`;
    const dias = o.encerrado_em ? `<span class="ob2-dias">${dataCurta(diaDoCarimbo(o.encerrado_em)).slice(0, 5)}</span>`
      : s.concluido ? '<span class="ob2-dias g">pronto</span>' : `<span class="ob2-dias${parado ? ' r' : ''}">${haDias(s.atual?.dias_parada)}</span>`;
    const head = resp ? `<i class="ob2-pes" title="${esc(resp)}" aria-hidden="true">${esc(duasLetras(resp))}</i>`
      : `<i class="ob2-pes vago" title="Sem responsável" aria-hidden="true">?</i>`;
    const rot = grupo ? `<span class="ob2-rot ${grupo === 'Agora' ? 'r' : ''}">${esc(grupo)}</span>` : '<span class="ob2-rot"></span>';
    const seg = segmentoDe(o.cliente_id);
    const kickoffAgora = pode && s.atual?.id === 'kickoff' && typeof window.abrirReuniao === 'function';
    const acaoDaLinha = !podeOnboarding(o.cliente_id) ? btnOb('Ver etapas', `data-vc-abrir="${esc(chave)}"`)
      : o.encerrado_em ? btnOb('Reabrir', `data-vc-onb="onboarding_reabrir" data-vc-cli="${esc(o.cliente_id)}"`)
      : sit.tipo === 'pronto' ? btnOb('Encerrar onboarding', `data-vc-onb="onboarding_encerrar" data-vc-cli="${esc(o.cliente_id)}"`)
      : sit.tipo === 'sem-dono' ? btnOb('Definir responsável', `data-vc-abrir="${esc(chave)}" data-vc-focar="resp"`)
      : kickoffAgora ? btnOb('Marcar o kickoff', `data-vc-kickoff="${esc(o.cliente || '')}"`)
      : btnOb('Ver o checklist', `data-vc-abrir="${esc(chave)}"`);
    const detalhe = etapas.map((e, i) => {
      const dela = o.etapas?.[e.id] || {}, st = s.etapas.find((x) => x.id === e.id);
      return `<fieldset class="vc-etapa ob2-etapa"><legend><i class="ob2-cx${st?.concluida ? ' ok' : s.atual?.id === e.id ? ' at' : ''}" aria-hidden="true">${st?.concluida ? CHECK : ''}</i><span class="${st?.concluida ? 'feita' : ''}">${i + 1} · ${esc(e.nome)}</span> <small>${st ? `${st.feitos}/${st.total}` : ''}</small></legend>
        <label class="vc-campo"><span>Responsável</span><select data-vc-resp="${esc(o.cliente_id)}" data-vc-etapa="${esc(e.id)}"${pode ? '' : ' disabled'}>
          <option value="">Sem responsável</option>${pessoas.map((p) => `<option value="${esc(p.id)}"${String(dela.responsavel_id) === String(p.id) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <ul class="vc-check">${e.itens.map((it) => { const f = dela.feitos?.[it.id];
          return `<li><label><input type="checkbox" data-vc-item="${esc(it.id)}" data-vc-etapa="${esc(e.id)}" data-vc-cli="${esc(o.cliente_id)}"${f ? ' checked' : ''}${pode ? '' : ' disabled'}>
            <span>${esc(it.texto)}${f ? `<small>${esc(f.por || '')} · ${dataCurta(diaDoCarimbo(f.em))}</small>` : ''}</span></label></li>`; }).join('') || '<li class="vc-nota">Etapa sem itens.</li>'}</ul></fieldset>`;
    }).join('');
    // Reunião e questionário (vybe-clientes-reunioes.js): o kickoff grava o áudio; o questionário serve para preencher junto
    // na reunião ou para mandar o link ao cliente.
    const atalhos = `<div class="ob2-atalhos">${pode && typeof window.abrirReuniao === 'function' ? `${btnOb('Reunião de kickoff', `data-vc-kickoff="${esc(o.cliente || '')}"`)}
        ${btnOb('Questionário com o cliente', `data-vc-quest="junto" data-vc-cli="${esc(o.cliente_id)}" data-vc-nome="${esc(o.cliente || '')}"`)}
        ${btnOb('Link do questionário', `data-vc-quest="link" data-vc-cli="${esc(o.cliente_id)}"`)}` : ''}
        ${btnOb('Ficha', `data-vc-cliente="${esc(o.cliente || '')}"`)}
        ${podeOnboarding(o.cliente_id) ? (o.encerrado_em ? '' : btnOb('Encerrar onboarding', `data-vc-onb="onboarding_encerrar" data-vc-cli="${esc(o.cliente_id)}"`)) : '<span class="ob2-sub">Só quem administra, o Atendimento e os heads do cliente mexem aqui.</span>'}</div>`;
    return `<li class="v2-abre ob2-linha${o.encerrado_em ? ' encerrado' : ''}" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="ob2-lin">
        <button type="button" class="ob2-abrir" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${o.cliente || 'Cliente'}: ${sit.texto}`)}">
          ${rot}${fotoCli(o.cliente || '')}<span class="ob2-nm"><b>${esc(o.cliente || '')}</b>${seg ? ` <span>· ${esc(seg)}</span>` : ''}</span>${trilha}${etapa}${dias}${head}</button>
        <span class="ob2-ac">${acaoDaLinha}</span></div>
      <div class="v2-mais"><div><div class="ob2-det">${detalhe}${atalhos}</div></div></div></li>`;
  }
  function editorEtapasHtml() {
    const lista = estado.editorEtapas;
    return `<section class="vc-secao vc-editor" aria-label="Configurar etapas">
      <div class="vc-secao-topo"><h3>Etapas do onboarding</h3></div>
      <ol class="vc-ed-lista">${lista.map((e, i) => `<li class="vc-ed-etapa">
        <div class="vc-ed-cab"><input type="text" maxlength="40" value="${esc(e.nome)}" aria-label="Nome da etapa ${i + 1}" data-vc-ed-nome="${i}">
          <button type="button" class="vc-ico" data-vc-ed-mover="${i}:-1" aria-label="Subir ${esc(e.nome)}"${i ? '' : ' disabled'}>↑</button>
          <button type="button" class="vc-ico" data-vc-ed-mover="${i}:1" aria-label="Descer ${esc(e.nome)}"${i < lista.length - 1 ? '' : ' disabled'}>↓</button>
          <button type="button" class="vc-ico perigo" data-vc-ed-tirar="${i}" aria-label="Tirar ${esc(e.nome)}"${lista.length > 1 ? '' : ' disabled'}>×</button></div>
        <ul>${e.itens.map((it, j) => `<li><input type="text" maxlength="120" value="${esc(it.texto)}" aria-label="Item ${j + 1} de ${esc(e.nome)}" data-vc-ed-item="${i}:${j}">
          <button type="button" class="vc-ico" data-vc-ed-item-mover="${i}:${j}:-1" aria-label="Subir item"${j ? '' : ' disabled'}>↑</button>
          <button type="button" class="vc-ico perigo" data-vc-ed-item-tirar="${i}:${j}" aria-label="Tirar item">×</button></li>`).join('')}</ul>
        <button type="button" class="vc-link" data-vc-ed-item-novo="${i}">+ Item</button></li>`).join('')}</ol>
      <div class="vc-linha-acoes"><button type="button" class="vc-link" data-vc-ed-nova>+ Etapa</button><span class="vc-espaco"></span>
        ${secundario('Voltar ao padrão', 'data-vc-ed-padrao')}${secundario('Cancelar', 'data-vc-ed-cancelar')}${acao('Salvar etapas', 'data-vc-ed-salvar')}</div>
      ${nota('Item tirado some da esteira; o que já foi marcado nele fica guardado e volta se o item voltar com o mesmo nome interno.')}</section>`;
  }
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  // "Como funciona", no vidro: a esteira numerada, com os itens de cada etapa (a do servidor; sem ela, o padrão).
  function comoFuncionaHtml(etapas, padrao) {
    const passos = (etapas.length ? etapas : padrao || []).map((e) => [e.nome, (e.itens || []).map((i) => i.texto).join(' · ') || plural(e.itens?.length || 0, 'item', 'itens')]);
    const lista = passos.length ? passos : [['Cadastro', 'dados, contrato e acessos'], ['Questionário e kickoff', 'o cliente responde, o head conduz'], ['Checklist', 'Drive, grupo, primeiro planejamento']];
    return `<section class="d3m-cons ob2-como" aria-label="Como funciona a esteira"><div class="d3m-cons-cab"><b>Como funciona</b><span>${plural(lista.length, 'etapa', 'etapas')}</span></div>
      <ol class="ob2-esteira">${lista.map(([nome, itens], i) => `<li><i aria-hidden="true">${i + 1}</i><span><b>${esc(nome)}</b><small>${esc(itens)}</small></span></li>`).join('')}</ol>
      <p class="ob2-nota">Começa quando entra um cliente novo ou um contrato novo de um cliente da casa. Cada etapa tem o checklist e o responsável dela; "parado" conta desde o último movimento da etapa de agora.</p></section>`;
  }
  // Os dias de cada etapa já concluída (da conclusão da anterior, ou do início, até a conclusão dela), por etapa.
  function diasPorEtapa(lista) {
    const porEtapa = new Map();
    for (const o of lista) {
      let antes = Date.parse(o.iniciado_em);
      for (const e of o.situacao?.etapas || []) {
        const fim = e.concluida ? Date.parse(e.concluida_em) : NaN;
        if (!Number.isFinite(fim)) break;
        if (Number.isFinite(antes) && fim >= antes) { const x = porEtapa.get(e.id) || []; x.push((fim - antes) / 864e5); porEtapa.set(e.id, x); }
        antes = fim;
      }
    }
    return porEtapa;
  }
  const diasTxt = (d) => (d == null ? '—' : d < 0.5 ? 'menos de 1 dia' : plural(Math.round(d), 'dia', 'dias'));
  function abaOnboarding() {
    const sv = estado.servidor;
    const titulo = (sub) => `<div class="ob2-tit"><h2 id="vc-titulo">Onboarding</h2><span>${esc(sub)}</span></div>`;
    if (!sv) return { v2: true, titulo: titulo('cliente novo ou contrato novo'), corpo: estado.erro ? vazio(estado.erro, secundario('Tentar de novo', 'data-vc-recarregar')) : '' };
    const etapas = sv.etapas || [], ligado = Boolean(sv.onboarding?.disponivel);
    if (ligado && estado.editorEtapas) return { v2: true, titulo: titulo('configurar as etapas da esteira'), corpo: `<div class="fv2-folha ob2-editor">${editorEtapasHtml()}</div>` };
    const lista = ligado ? sv.onboarding.clientes || [] : [];
    const emAberto = lista.filter((o) => !o.encerrado_em), encerrados = lista.filter((o) => o.encerrado_em);
    const ocupados = new Set(emAberto.map((o) => o.cliente_id));
    const candidatos = ligado ? (sv.clientes || []).filter((c) => c.ativo && !ocupados.has(c.id) && podeOnboarding(c.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : [];
    // Onboarding começa por um fato novo (Paulo, 09/11/2026: "qual sentido de eu fazer onboard com quem já é cliente?"):
    // cliente novo (cadastro → esteira) ou contrato novo de um cliente da casa (renovação, serviço novo: esteira do zero).
    const podeNovo = ligado && typeof window.abrirCadastroCompleto === 'function' && (typeof podeEditarClientes !== 'function' || podeEditarClientes());
    const podeComecar = podeNovo || candidatos.length > 0;
    const sitDe = new Map(emAberto.map((o) => [o, situacaoDaLinha(o)]));
    const parados = emAberto.filter((o) => sitDe.get(o).tipo === 'parado').sort((a, b) => (b.situacao.atual?.dias_parada ?? 0) - (a.situacao.atual?.dias_parada ?? 0));
    const pedem = emAberto.filter((o) => sitDe.get(o).pede), pior = parados[0];
    const duracao = (o) => (Date.parse(o.encerrado_em) - Date.parse(o.iniciado_em)) / 864e5;
    const duracoes = encerrados.map(duracao).filter((d) => Number.isFinite(d) && d >= 0);
    const media = duracoes.length ? Math.max(1, Math.round(duracoes.reduce((t, d) => t + d, 0) / duracoes.length)) : null;
    const mesAgora = hoje().slice(0, 7), concluidosMes = encerrados.filter((o) => diaDoCarimbo(o.encerrado_em).startsWith(mesAgora));
    const nomeMes = new Date(`${mesAgora}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long' });
    // O alto: o título com a frase do momento; busca, "Como funciona", "Novo onboarding" (branco no vidro) e fechar.
    const sub = !ligado ? 'cliente novo ou contrato novo' : `cliente novo ou contrato novo · ${emAberto.length} em entrada${pior ? ` · ${parados.length > 1 ? `${parados.length} parados` : `1 parado ${haDias(pior.situacao.atual?.dias_parada)}`}` : ''}`;
    const topo = `<label class="ob2-busca"><span class="ob2-so-leitor">Buscar cliente em onboarding</span><input type="search" data-vc-busca-onb placeholder="Buscar cliente" value="${esc(estado.buscaOnb)}"${estado.buscaOnb ? ' class="tem"' : ''}></label>
      <button type="button" class="ob2-ico" data-vc-como aria-expanded="${estado.ajuda}" aria-label="Como funciona" title="Como funciona"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button>
      ${podeComecar ? `<button type="button" class="ob2-novo" data-vc-novo aria-expanded="${Boolean(estado.novoOnb)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Novo onboarding</button>` : ''}`;
    // Botão desativado sem motivo à vista (auditoria 15/11, item 36): sem poder começar, o botão sai e o motivo fica escrito ao lado.
    const contrato = estado.contratoNovo ? `<div class="vc-iniciar"><label class="vc-campo"><span>Cliente que fechou contrato novo</span><select data-vc-novo-onb>${candidatos.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
      ${btnOb('Cancelar', 'data-vc-contrato-novo')}${btnOb('Começar a esteira', 'data-vc-iniciar')}</div>` : '';
    const iniciar = estado.novoOnb && podeComecar ? `<section class="fv2-folha ob2-comecar vc-onb-comecar" aria-label="Começar um onboarding">
      <div class="vc-onb-caminhos">
        ${podeNovo ? `<button type="button" class="vc-onb-caminho" data-vc-onb-novo><b>Cliente novo</b><small>Cadastra o cliente e já abre a esteira, o questionário e o kickoff.</small></button>` : ''}
        ${candidatos.length ? `<button type="button" class="vc-onb-caminho" data-vc-contrato-novo aria-expanded="${Boolean(estado.contratoNovo)}"><b>Contrato novo</b><small>Cliente da casa que renovou ou fechou um serviço novo: a esteira começa do zero.</small></button>` : ''}
      </div>${contrato}</section>` : '';
    // As fichas das etapas: quantos clientes estão em cada uma e há quanto tempo o mais parado está ali; o clique filtra.
    // Sem etapas do servidor (esteira ainda não ligada), as fichas mostram o caminho padrão, zerado.
    const etapasDoFiltro = etapas.length ? etapas : sv.etapas_padrao?.length ? sv.etapas_padrao : [{ id: 'cadastro', nome: 'Cadastro' }, { id: 'kickoff', nome: 'Questionário e kickoff' }, { id: 'checklist', nome: 'Checklist' }];
    if (estado.etapaOnb !== 'todas' && !etapasDoFiltro.some((e) => e.id === estado.etapaOnb)) estado.etapaOnb = 'todas';
    const nelas = (id) => emAberto.filter((o) => !o.situacao.concluido && o.situacao.atual?.id === id);
    const mediaMes = concluidosMes.length ? Math.max(1, Math.round(concluidosMes.map(duracao).reduce((t, d) => t + d, 0) / concluidosMes.length)) : null;
    const mesFicha = typeof mesCurto === 'function' ? mesCurto(mesAgora) : nomeMes;
    const fichas = `<div class="ob2-fichas" role="group" aria-label="Filtrar pela etapa">${etapasDoFiltro.map((e, i) => {
      const x = nelas(e.id), maior = x.length ? Math.max(...x.map((o) => o.situacao.atual?.dias_parada ?? 0)) : null, ligada = estado.etapaOnb === e.id;
      return `<button type="button" class="ob2-ficha" data-vc-etapa-onb="${ligada ? 'todas' : esc(e.id)}" aria-pressed="${ligada}"><span>${i + 1} ${esc(e.nome)}</span>
        <span><b>${x.length}</b><small${maior != null && maior > DIAS_PARADO ? ' class="r"' : ''}>${maior == null ? 'ninguém' : haDias(maior)}</small></span></button>`; }).join('')}
      <button type="button" class="ob2-ficha" data-vc-encerrados aria-expanded="${estado.verEncerrados}"${encerrados.length ? '' : ' disabled'} title="${encerrados.length ? `${estado.verEncerrados ? 'Esconder' : 'Ver'} os encerrados na lista` : 'Nenhum onboarding encerrado ainda'}"><span>Concluídos<small>${esc(mesFicha)}</small></span>
        <span><b>${concluidosMes.length}</b><small>${mediaMes == null ? 'nenhum ainda' : `em ${plural(mediaMes, 'dia', 'dias')}`}</small></span></button></div>`;
    // A folha dos clientes em entrada: "pede ação" (parado, sem responsável, pronto para encerrar) antes de "andando".
    const termo = semAcento(estado.buscaOnb).trim();
    const passa = (o) => (!termo || semAcento(o.cliente).includes(termo)) && (estado.etapaOnb === 'todas' || (!o.situacao.concluido && o.situacao.atual?.id === estado.etapaOnb));
    const porParada = (a, b) => (b.situacao.atual?.dias_parada ?? -1) - (a.situacao.atual?.dias_parada ?? -1);
    const pedeAcao = emAberto.filter((o) => passa(o) && sitDe.get(o).pede).sort(porParada), andando = emAberto.filter((o) => passa(o) && !sitDe.get(o).pede).sort(porParada);
    const limite = estado.limite.onboarding || PAGINA, cabem = andando.slice(0, Math.max(0, limite - pedeAcao.length)), resto = andando.length - cabem.length;
    const chips = `<span class="ob2-chips" role="group" aria-label="Filtrar pela etapa">${[['todas', 'Todas as etapas', emAberto.length], ...etapasDoFiltro.map((e) => [e.id, e.nome, nelas(e.id).length])]
      .filter(([id, , q]) => id === 'todas' || q > 0 || estado.etapaOnb === id).map(([id, rotulo, q]) => `<button type="button" class="ob2-chip" data-vc-etapa-onb="${esc(id)}" aria-pressed="${estado.etapaOnb === id}">${esc(rotulo)}<span>${q}</span></button>`).join('')}</span>`;
    const linhas = [...pedeAcao.map((o, i) => linhaOnboarding(o, etapas, i ? '' : 'Agora')), ...cabem.map((o, i) => linhaOnboarding(o, etapas, i ? '' : 'Andando'))];
    const fechados = estado.verEncerrados ? encerrados.filter((o) => !termo || semAcento(o.cliente).includes(termo)) : [];
    linhas.push(...fechados.map((o, i) => linhaOnboarding(o, etapas, i ? '' : 'Encerrados')));
    const vazioDaLista = !ligado ? (typeof fv2VazioHtml === 'function' ? fv2VazioHtml('relogio', 'O onboarding ainda não está disponível', 'Quando estiver, quem está entrando aparece aqui.') : '<div class="fv2-vazio"><b>O onboarding ainda não está disponível</b></div>')
      : !emAberto.length ? `<div class="fv2-vazio"><b>Nenhum cliente em entrada</b><span>Cliente novo ou contrato novo de um cliente da casa abre a esteira.</span></div>`
      : `<div class="fv2-vazio"><b>Nenhum cliente neste filtro</b>${btnOb('Ver todos', 'data-vc-etapa-onb="todas" data-vc-limpar')}</div>`;
    const folhaLista = `<section class="fv2-folha ob2-lista" aria-label="Clientes em entrada">
      <div class="ob2-cab"><h3>${plural(emAberto.length, 'cliente em entrada', 'clientes em entrada')}${emAberto.length > 1 ? '<span> · o parado há mais tempo primeiro</span>' : ''}</h3>${ligado && emAberto.length ? chips : ''}</div>
      ${linhas.length ? `<div class="ob2-th" aria-hidden="true"><span class="ob2-th-l"><span></span><span></span><span>Cliente</span><span>Etapas</span><span>Agora</span><span>Parado</span><span>Head</span></span><span></span></div>
      <ol class="ob2-linhas">${linhas.join('')}${resto > 0 ? `<li class="ob2-mais">+ ${plural(resto, 'cliente', 'clientes')} andando · ${ligacao('mostrar', 'data-vc-mais="onboarding"')}</li>` : ''}</ol>` : vazioDaLista}</section>`;
    // "Quanto cada etapa demora": a média de quem já passou por ela, com a barra (vermelha acima de DIAS_PARADO) e quem está nela agora.
    const porEtapa = diasPorEtapa(lista), medias = etapasDoFiltro.map((e) => { const x = porEtapa.get(e.id) || []; return x.length ? x.reduce((t, d) => t + d, 0) / x.length : null; });
    const teto = Math.max(DIAS_PARADO * 1.5, ...medias.filter((m) => m != null));
    const folhaEtapas = `<section class="fv2-folha ob2-etapas" aria-label="Quanto cada etapa demora">
      <div class="ob2-cab"><h3>Quanto cada etapa demora</h3><span class="ob2-cab-nota">média de quem já passou, em dias</span></div>
      <ol class="ob2-et-linhas">${etapasDoFiltro.map((e, i) => { const m = medias[i], q = nelas(e.id).length, itens = (e.itens || []).map((x) => x.texto.replace(/^./, (c) => c.toLowerCase())).join(', ');
        return `<li class="ob2-et"><i class="fv2-n">${i + 1}</i><span class="ob2-et-nm"><b>${esc(e.nome)}</b>${itens ? ` <span>· ${esc(itens)}</span>` : ''}</span>
          <span class="ob2-et-barra${m != null && m > DIAS_PARADO ? ' r' : ''}" role="img" aria-label="${esc(`${e.nome}: ${diasTxt(m)} em média`)}"><i style="--v:${m == null ? 0 : Math.max(3, Math.round((m / teto) * 100))}%"></i></span>
          <span class="ob2-et-d">${m == null ? '—' : m < 0.5 ? '<b>&lt;1</b> dia' : `<b>${Math.round(m)}</b> ${Math.round(m) === 1 ? 'dia' : 'dias'}`}</span>
          <span class="ob2-et-q">${q ? plural(q, 'cliente agora', 'clientes agora') : 'ninguém agora'}</span></li>`; }).join('')}</ol>
      <div class="ob2-olho"><span class="ob2-olho-rot">De olho</span>
        <span class="ob2-olho-i"><b>${media == null ? '—' : plural(media, 'dia', 'dias')}</b><small>tempo médio de entrada</small></span>
        <button type="button" class="ob2-olho-i" data-vc-encerrados aria-expanded="${estado.verEncerrados}"${encerrados.length ? '' : ' disabled'}><b class="${concluidosMes.length ? 'g' : ''}">${concluidosMes.length}</b><small>${concluidosMes.length === 1 ? 'concluído' : 'concluídos'} em ${esc(nomeMes)}</small></button>
        ${pior ? `<button type="button" class="ob2-olho-i" data-vc-abrir="o:${esc(pior.cliente_id)}" data-vc-focar="linha"><b class="r">${parados.length}</b><small>${parados.length === 1 ? 'parado' : 'parados'} há ${DIAS_PARADO + 1} dias ou mais</small></button>` : `<span class="ob2-olho-i"><b>0</b><small>parado há ${DIAS_PARADO + 1} dias ou mais</small></span>`}</div></section>`;
    // O vidro: o laranja só com ação (auditoria 15/11, itens 3 e 27); sem ação, a frase calma no vidro.
    const foco = pior || pedem[0] || emAberto[0] || null;
    const AG = AGENTE;
    const laranja = (rotulo, n, frase, apoio, botoes) => `<section class="d3-acao d3m-laranja ob2-laranja" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${esc(AG.nome[0])}</span>${esc(AG.nome)} · ${esc(rotulo)}</span>
      <span class="d3m-lar-txt">${n === '' ? '' : `<b class="d3m-lar-num">${esc(n)}</b>`}<span class="d3-acao-frase">${frase}</span>${apoio ? `<small>${apoio}</small>` : ''}<span class="d3m-lar-bts">${botoes}</span></span></section>`;
    const calmo = (frase, texto) => `<section class="ob2-calmo" aria-label="${esc(`${AG.nome}, ${AG.papel}`)}"><b>${frase}</b><span>${texto}</span></section>`;
    const faltaDe = (o) => { const def = etapas.find((e) => e.id === o.situacao.atual?.id), f = o.etapas?.[def?.id]?.feitos || {}; return (def?.itens || []).filter((i) => !f[i.id]); };
    let alto;
    if (!ligado) alto = calmo('O onboarding ainda não está disponível.', 'Quando estiver, quem está entrando aparece aqui.');
    else if (!emAberto.length) alto = podeComecar ? laranja('ninguém entrando', '', 'Ninguém entrando agora.', 'Cliente novo ou contrato novo de um cliente da casa abre a esteira.', btnLar('Novo onboarding', 'data-vc-novo')) : calmo('Ninguém entrando agora.', 'Quando um cliente novo entrar, a esteira aparece aqui.');
    else if (pior) {
      const falta = faltaDe(pior), d = pior.situacao.atual?.dias_parada ?? 0, pode = podeOnboarding(pior.cliente_id);
      const principal = pode && pior.situacao.atual?.id === 'kickoff' && typeof window.abrirReuniao === 'function' ? btnLar('Marcar o kickoff', `data-vc-kickoff="${esc(pior.cliente || '')}"`)
        : btnLar('Ver o checklist', `data-vc-abrir="o:${esc(pior.cliente_id)}" data-vc-focar="linha"`);
      alto = laranja('parado na entrada', plural(d, 'dia', 'dias'), `em ${esc(String(pior.situacao.atual?.nome || 'etapa').toLowerCase())} com ${esc(pior.cliente || 'o cliente')}`,
        `${falta.length ? `Falta ${esc(falta[0].texto.replace(/^./, (c) => c.toLowerCase()))}${falta.length > 1 ? ` e mais ${falta.length - 1}` : ''}.` : ''}${parados.length > 1 ? ` Mais ${plural(parados.length - 1, 'cliente parado', 'clientes parados')}.` : ''}`,
        `${principal}${btnLar('Abrir a ficha', `data-vc-cliente="${esc(pior.cliente || '')}"`, true)}`);
    } else if (pedem.length) {
      const um = pedem[0];
      alto = laranja('pede ação', String(pedem.length), pedem.length === 1 ? `${esc(um.cliente || 'cliente')} pede ação na entrada` : 'clientes pedem ação na entrada',
        esc(pedem.slice(0, 3).map((o) => `${o.cliente}: ${sitDe.get(o).texto.toLowerCase()}`).join(' · ')), btnLar(pedem.length === 1 ? `Ver ${um.cliente || 'o cliente'}` : 'Ver o primeiro', `data-vc-abrir="o:${esc(um.cliente_id)}" data-vc-focar="linha"`));
    } else alto = calmo(`${plural(emAberto.length, 'cliente entrando', 'clientes entrando')} · nenhum travou.`, 'Cada etapa anda com o responsável dela.');
    const podeFoco = foco && podeOnboarding(foco.cliente_id) && typeof window.abrirReuniao === 'function';
    const questionario = podeFoco ? consulta('O questionário', foco.cliente || '', vlin('Link para o cliente', 'ele responde sozinho', `data-vc-quest="link" data-vc-cli="${esc(foco.cliente_id)}"`)
      + vlin('Preencher na reunião', '', `data-vc-quest="junto" data-vc-cli="${esc(foco.cliente_id)}" data-vc-nome="${esc(foco.cliente || '')}"`)) : '';
    const abrirLinhas = [
      sv.pode?.etapas && ligado ? vlin('Configurar as etapas', '', 'data-vc-ed-abrir') : '',
      window.VybeReunioes?.abrir ? vlin('Reuniões', 'kickoffs marcados', 'data-vc-reunioes') : '',
      vlin('Como funciona', 'as etapas e os itens', `data-vc-como aria-expanded="${estado.ajuda}"`),
      encerrados.length ? vlin(`${estado.verEncerrados ? 'Esconder' : 'Ver'} encerrados`, String(encerrados.length), `data-vc-encerrados aria-expanded="${estado.verEncerrados}"`) : '',
      !ligado && souAdminAqui() ? vlin('Ver o que falta', 'para ligar o onboarding', `data-vc-falta aria-expanded="${estado.verFalta}"`) : '',
    ].join('');
    const lado = `${alto}${estado.ajuda ? comoFuncionaHtml(etapas, sv.etapas_padrao) : ''}${questionario}${consulta('Abrir', sv.pode?.etapas ? 'quem administra' : '', abrirLinhas)}
      ${ligado && !podeComecar ? '<p class="ob2-nota">Só quem administra, o Atendimento e os heads começam um onboarding.</p>' : ''}`;
    // Sem a esteira ligada, para quem administra, o que falta.
    const pe = ligado || !(estado.verFalta && souAdminAqui()) ? '' : `<p class="ob2-nota ob2-tec"><small class="vc-ativacao-tec">Falta aplicar a migração <code>${esc(sv.migracao || '2026-11-07-carteira.sql')}</code> no banco. Depois disso, esta parte aparece sozinha.</small></p>`;
    return { v2: true, titulo: titulo(sub), topo, corpo: `<div class="fv2-duas ob2-duas"><div class="fv2-col">${iniciar}${fichas}${folhaLista}${folhaEtapas}</div><aside class="d3m-lado fv2-lado" aria-label="Consulta">${lado}${pe}</aside></div>` };
  }

  // ---------- Churn ----------
  // ===== Churn e Contratos pelos quadros do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
  // As duas telas seguem as pranchas V2-M-Contratos e V2-M-Churn (16/11/2026): o topo no vidro, a folha com a lista e a
  // coluna de consulta com o cartão laranja. O período (Mensal/Anual e o mês) e a ordem abrem pelo "Mais"; a conta do
  // LTV, do mês a mês e do churn em "Como funciona". O que vai ao servidor não mudou: formContrato e formChurn.
  const AGENTE_CONTRATOS = { nome: 'Vorcaro', papel: 'Financeiro e contratos' };
  const AGENTE_CHURN = { nome: 'VYBES', papel: 'Comercial' };
  const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesCurto = (ym) => MES_CURTO[Number(String(ym).slice(5, 7)) - 1] || '';
  const mesAno = (iso) => (iso ? `${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '');
  const diaMes = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const reaisCurto = (v) => (v == null ? '—' : Math.abs(v) >= 1000 ? `R$ ${virgula(Math.round(v / 100) / 10)} mil` : reais(v));
  const mesesDe = (de, ate) => Math.max(0, Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5 / (S()?.DIAS_MES || 30.44)));
  const nomesEm = (nomes) => (nomes.length <= 2 ? nomes.map((n) => `<b>${esc(n)}</b>`).join(' e ') : `${nomes.slice(0, 2).map((n) => `<b>${esc(n)}</b>`).join(', ')} e mais ${nomes.length - 2}`);
  const termoDaBusca = () => semAcento(estado.busca[estado.aba] || '').trim();
  const ehAdminAqui = () => souAdminAqui();

  // ---------- Peças das pranchas V2-M-Contratos e V2-M-Churn (16/11/2026) ----------
  // As duas telas saem da janela clara: o topo e a tela ficam direto no vidro fumê (padrao-v2/zm-d-carteira.css), com as
  // peças .d3m-d-* de zm-d-0-pecas.css e as .d3m-* de z-direcao.css. Cada aba devolve { topo, ajuda, corpo }.
  const TELAS_M = new Set(['contratos', 'churn', 'saude']);
  const svgM = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICQ = { baixo: svgM('<path d="M6 9l6 6 6-6"/>'), seta: svgM('<path d="M9 6l6 6-6 6"/>'), busca: svgM('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'), pontos: svgM('<path d="M5 12h.01M12 12h.01M19 12h.01"/>'),
    mais: svgM('<path d="M12 5v14M5 12h14"/>'), ajuda: svgM('<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17h.01"/>'),
    alerta: svgM('<path d="M12 7v6M12 17h.01"/>'), dinheiro: svgM('<path d="M12 4v16M16 8.5c0-1.4-1.8-2.5-4-2.5s-4 1.1-4 2.5 1.8 2.5 4 3 4 1.6 4 3-1.8 2.5-4 2.5-4-1.1-4-2.5"/>'), relogio: svgM('<circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/>'), sai: svgM('<path d="M14 7l5 5-5 5M19 12H8"/>') };
  const VISTAS_COM = [['funil', 'CRM e funil'], ['conversas', 'Conversas'], ['pacotes', 'Produtos e pacotes'], ['orcamentos', 'Orçamentos'], ['contratos', 'Contratos'], ['churn', 'Churn']];
  // Dinheiro só para dono, também no "ver como" (a mesma regra do souDonoDoDinheiro de vybe-mundo.js): o servidor já manda
  // a carteira sem valores para quem não é dono; vendo como outra pessoa, a sessão é de dono e quem esconde é a tela.
  const vendoComoSemDinheiro = () => { try { const id = sessionStorage.getItem('vybe.verComo'); if (!id) return false;
    const time = typeof TEAM_USERS !== 'undefined' && Array.isArray(TEAM_USERS) ? TEAM_USERS : []; return time.find((u) => String(u.id) === String(id))?.dono !== true; } catch { return false; } };
  const veDinheiro = () => estado.servidor?.pode?.ver_dinheiro !== false && !vendoComoSemDinheiro();
  const semValor = (lista, campo) => (veDinheiro() ? lista : (lista || []).map((x) => (x ? { ...x, [campo]: null } : x)));
  const clientesM = () => semValor(estado.servidor?.clientes || [], 'valor');
  const contratosM = () => semValor(listaContratos(), 'valor_mensal');
  // Ir a outra tela do Comercial pelo item do menu lateral (marca o item e abre a janela certa); sem o menu, direto.
  function irVista(id) {
    const b = document.querySelector?.(`.vv-trilho [data-submodulo="${id}"]`);
    if (b) { if (!TELAS_M.has(id)) fechar({ foco: false }); b.click(); return; }
    if (TELAS_M.has(id)) { estado.aba = id; if (estado.soAbas) estado.soAbas = new Set([id]); estado.form = null; estado.aviso = ''; return pintar(); }
    fechar({ foco: false }); window.VybeComercial?.abrir?.(id, { abas: [id] });
  }
  // O topo no vidro: o título abre as outras telas; à direita as ferramentas, o "Mais" e a ação principal.
  function topoMq(t) {
    const nome = TITULO_DA_ABA[estado.aba], outras = abasVisiveis().filter(([k]) => !TELAS_M.has(k));
    const itens = [...(t?.mais || []), '<button type="button" role="menuitem" data-vc-fechar>Fechar</button>'];
    return `<div class="d3m-d-topo d3m-d-ct-topo"><div class="d3m-d-tit">${t?.semTroca ? `<h2 id="vc-titulo">${esc(nome)}</h2>` : `<details class="d3m-d-troca"><summary aria-label="${esc(nome)}: ir a outra tela do Comercial"><h2 id="vc-titulo">${esc(nome)}</h2>${ICQ.baixo}</summary>
        <div class="d3m-d-pop">${VISTAS_COM.map(([id, n]) => `<button type="button" data-vc-ir="${id}"${id === estado.aba ? ' aria-current="page"' : ''}>${esc(n)}</button>`).join('')}${outras.map(([k, r]) => `<button type="button" data-vc-aba="${k}">${esc(r)}</button>`).join('')}</div></details>`}
        <span class="d3m-d-sub">${t?.sub || esc(FRASE_DA_ABA[estado.aba])}</span></div>
      <div class="d3m-d-ferr">${t?.ferr || ''}<button type="button" class="d3m-d-ico" data-vc-como aria-expanded="${estado.ajuda}" aria-label="Como funciona" title="Como funciona">${ICQ.ajuda}</button>
        <details class="d3m-d-mais"><summary class="d3m-d-ico" aria-label="Mais opções" title="Mais opções">${ICQ.pontos}</summary><div class="d3m-d-pop" role="menu">${itens.join('')}</div></details>${t?.acao || ''}</div></div>`;
  }
  const buscaM = (rotulo) => `${estado.buscaAberta || termoDaBusca() ? `<input type="search" class="d3m-d-ct-busca" data-vc-busca placeholder="Buscar cliente" aria-label="${esc(rotulo)}" value="${esc(estado.busca[estado.aba] || '')}">` : ''}<button type="button" class="d3m-d-ico" data-vc-busca-abre aria-expanded="${Boolean(estado.buscaAberta || termoDaBusca())}" aria-label="Buscar" title="Buscar">${ICQ.busca}</button>`;
  // O cartão laranja: quem fala e sobre o quê, o número grande, a frase, a linha de apoio e até dois botões.
  const larMq = (ag, rot, n, frase, apoio, bts) => `<section class="d3m-laranja d3m-d-ct-pesa" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">${esc(ag.nome[0])}</span>${esc(ag.nome)} · ${esc(rot)}</span>
      <div class="d3m-lar-txt">${n !== '' && n != null ? `<b class="d3m-lar-num">${esc(n)}</b>` : ''}<span class="d3-acao-frase">${frase}</span>${apoio ? `<small>${apoio}</small>` : ''}${bts ? `<div class="d3m-lar-bts">${bts}</div>` : ''}</div></section>`;
  // Os botões do cartão laranja usam o btnLar do Onboarding (lá em cima): o mesmo botão, declarado uma vez só.
  // Número em folha: rótulo e selo em cima; embaixo o número de 28 (na cor do que diz), a linha de apoio e o gráfico.
  function numMq({ rotulo, selo = '', ic = '', valor, de = '', tom = '', sub = '', graf = '', attrs = '' }) {
    const tag = attrs ? 'button' : 'div';
    return `<${tag}${attrs ? ` type="button" ${attrs}` : ''} class="d3m-d-folha d3m-d-num"><span class="d3m-d-num-cab"><span>${esc(rotulo)}</span><span class="d3m-d-selo${selo ? ' ' + selo : ''}">${ic}</span></span>
      <span class="d3m-d-num-pe"><span><b class="d3m-d-num-v${tom ? ' ' + tom : ''}">${esc(valor)}${de ? `<small> ${esc(de)}</small>` : ''}</b><small>${sub}</small></span>${graf}</span></${tag}>`;
  }
  function miniMq(vals, cls = '') {
    const v = (vals || []).map(Number).filter(Number.isFinite); if (v.length < 2) return '';
    const mn = Math.min(...v), mx = Math.max(...v), w = 84, h = 40;
    const fio = v.map((n, i) => `${i ? 'L' : 'M'}${(2 + (i * (w - 4)) / (v.length - 1)).toFixed(1)} ${(mx === mn ? h / 2 : h - 3 - ((n - mn) * (h - 6)) / (mx - mn)).toFixed(1)}`).join(' ');
    return `<svg class="d3m-d-mini${cls ? ' ' + cls : ''}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><path class="veu" d="${fio} V${h} H2 Z"/><path class="fio" d="${fio}"/></svg>`;
  }
  // O quadradinho do cliente: as duas letras, numa das seis cores dos setores (sempre a mesma para o mesmo nome).
  const avM = (nome) => { let h = 0; for (const ch of String(nome || '')) h = (h * 31 + ch.charCodeAt(0)) % 997; return `<i class="d3m-d-ct-av c${h % 6}" aria-hidden="true">${esc(duasLetras(nome))}</i>`; };
  const segM = (rotulo, itens) => `<span class="d3m-d-pk-seg" role="group" aria-label="${esc(rotulo)}">${itens.map(([attrs, texto, n, ligada, tom]) => `<button type="button" ${attrs} aria-pressed="${Boolean(ligada)}">${esc(texto)}${n == null ? '' : ` <b${tom && n ? ` class="${tom}"` : ''}>${n}</b>`}</button>`).join('')}</span>`;
  // A parte ainda não ligada, numa tira no vidro; para quem administra, o que falta.
  const avisoM = (titulo, texto) => `<p class="d3m-d-ct-aviso" role="note"><span><b>${esc(titulo)}</b> ${esc(texto)}</span>${ehAdminAqui() ? `<button type="button" class="d3m-d-vbtn" data-vc-falta aria-expanded="${estado.verFalta}">Para quem administra: ver o que falta</button>` : ''}${estado.verFalta && ehAdminAqui()
    ? `<small>Falta aplicar a migração <code>${esc(estado.servidor?.migracao || '2026-11-07-carteira.sql')}</code> no banco. Depois disso, esta parte aparece sozinha.</small>` : ''}</p>`;
  // Período (Mensal ou Anual, com o mês) e a ordem da lista: abrem pelo "Mais", numa folha curta.
  const periodoM = (lista, ordens) => `<div class="d3m-d-folha d3m-d-ct-periodo" role="group" aria-label="Período e ordem">${segM('Período', [['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, r]) => [`data-vc-tipo="${k}"`, r, null, estado.tipo === k]))}
      ${typeof vbMesHtml === 'function' ? vbMesHtml({ mes: estado.mes, max: hoje().slice(0, 7), attr: 'data-vc-mes-ir', ano: estado.tipo === 'anual' }) : ''}${ordemHtml(lista, ordens)}<button type="button" class="d3m-d-elo" data-vc-filtros aria-expanded="true">Recolher</button></div>`;
  const vazioM = (frase, botaoHtml = '') => `<div class="d3m-d-ct-nada"><p>${frase}</p>${botaoHtml}</div>`;
  const btnFolha = (rotulo, attrs, k = false) => `<button type="button" class="d3m-d-ct-btn${k ? ' k' : ''}" ${attrs}>${esc(rotulo)}</button>`;

  function formChurn(s) {
    const f = estado.form;
    if (!f || f.tipo !== 'churn' || f.id !== s.id) return '';
    const motivo = f.motivo || s.motivo;
    return `<form class="vc-form" data-vc-form="churn" data-vc-cli="${esc(s.id)}">
      <label class="vc-campo"><span>Saiu em</span><input type="date" name="saiu_em" required value="${esc(s.saida)}" max="${esc(hoje())}"></label>
      <label class="vc-campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS()).map(([k, r]) => `<option value="${k}"${s.tipo === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="vc-campo"><span>Motivo</span><select name="motivo">${Object.entries(MOTIVOS()).map(([k, r]) => `<option value="${k}"${motivo === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="vc-campo"><span>Receita mensal (R$)</span><input type="number" name="receita_mensal" min="0" step="0.01" inputmode="decimal" value="${s.receita ?? ''}"></label>
      <label class="vc-campo largo"><span>O que aconteceu (obrigatório em "Outro")</span><textarea name="detalhe" maxlength="1000" rows="2">${esc(s.detalhe || s.motivoLivre || '')}</textarea></label>
      <div class="vc-linha-acoes"><span class="vc-espaco"></span>${secundario('Cancelar', 'data-vc-form-cancelar')}<button type="submit" class="vc-acao">Salvar motivo</button></div></form>`;
  }
  // "Por quê?": o motivo escolhido numa ficha já vai para o formulário (o mesmo que grava).
  const porQueHtml = (s) => `<p class="v2k-porque"><span class="v2c-sub">Por quê?</span>${Object.entries(MOTIVOS()).map(([k, r]) => ficha(esc(r), null, `data-vc-motivo-ch="${k}"`, (estado.form?.motivo || s.motivo) === k)).join('')}</p>`;
  // O vazio do padrão (vbEstadoHtml); sem a peça na página, a caixa simples de sempre.
  const estadoVazio = (titulo, texto = '', botao = '') => (typeof vbEstadoHtml === 'function' ? vbEstadoHtml({ titulo, texto, acao: botao }) : vazio([titulo, texto].filter(Boolean).join('. '), botao));
  function cohortHtml(c) {
    if (!c.linhas.length) return estadoVazio('Ainda sem data de entrada dos clientes', 'A retenção por mês de entrada aparece quando houver início de contrato ou data de cadastro.', estado.servidor?.pode?.contratos ? secundario('Registrar início nos contratos', 'data-vc-aba="contratos"') : '');
    const cor = (p) => (p == null ? '' : p >= 90 ? 'u6' : p >= 70 ? 'u4' : p >= 50 ? 'u2' : 'u3a');
    return `<div class="vc-tabela-rola"><table class="vc-cohort"><thead><tr><th scope="col">Entrada</th><th scope="col">Clientes</th>${c.colunas.map((n) => `<th scope="col">${n}º mês</th>`).join('')}</tr></thead>
      <tbody>${c.linhas.map((l) => `<tr><th scope="row">${esc(l.mes.slice(5, 7))}/${esc(l.mes.slice(2, 4))}</th><td>${l.entraram}</td>${l.colunas.map((x) => `<td class="${cor(x.pct)}" title="${x.pct == null ? 'ainda não chegou' : `${x.ficaram} de ${l.entraram}`}">${x.pct == null ? '' : `${x.pct}%`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${c.semEntrada ? nota(`${plural(c.semEntrada, 'cliente sem data de entrada fica', 'clientes sem data de entrada ficam')} de fora (a entrada é o início do contrato; sem ele, a data do cadastro).`) : ''}`;
  }
  const TIPO_CURTO = { cancelamento: 'cancelou', nao_renovou: 'não renovou', pausa: 'pausou' };
  const TIPO_FICHA = { cancelamento: 'Cancelou', nao_renovou: 'Não renovou', pausa: 'Pausou' };
  const podeChurn = () => Boolean(estado.servidor?.pode?.churn && estado.servidor?.churn?.disponivel && veDinheiro());
  const motivoDaSaida = (s) => (s.motivo ? MOTIVOS()[s.motivo] || s.motivo : 'sem motivo');
  // Quem saiu, em colunas: quem, quando, como, por quê, quanto levava por mês, quanto tempo ficou e o que dá para fazer.
  // O nome abre a linha no lugar (a data, o motivo por extenso e "Editar motivo"); o formulário de sempre abre embaixo.
  function linhaSaidaM(s, { din }) {
    const chave = `s:${s.id}`, formAqui = estado.form?.tipo === 'churn' && estado.form.id === s.id && estado.form.onde !== 'registrar';
    const aberto = formAqui || estado.abertos.has(chave), pode = podeChurn();
    const porque = [s.tipo ? TIPOS()[s.tipo] : 'Sem tipo', String(motivoDaSaida(s)).toLowerCase()].join(' · ');
    const acao = formAqui ? '' : pode && !s.classificado ? btnFolha('Registrar motivo', `data-vc-form-abrir="churn" data-vc-cli="${esc(s.id)}" data-vc-onde="lista"`) : btnFolha('Abrir a ficha', `data-vc-cliente="${esc(s.nome)}"`);
    return `<li class="d3m-d-ch-li" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="d3m-d-ch-lin${din ? '' : ' sem-valor'}">
          <button type="button" class="d3m-d-ch-n" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${s.nome}, ${porque}`)}">${esc(s.nome)}</button>
          <span>${esc(diaMes(s.saida))}</span><span>${esc(s.tipo ? (TIPO_CURTO[s.tipo] || TIPOS()[s.tipo]) : 'sem tipo')}</span>
          <span class="d3m-d-ch-mot${s.motivo ? '' : ' a'}">${esc(s.motivo ? motivoDaSaida(s) : 'sem motivo')}</span>
          ${din ? `<span class="d3m-d-ch-v">${s.receita == null ? 'sem valor' : esc(reais(s.receita))}</span>` : ''}<span class="d3m-d-ch-v">${s.meses == null ? 'sem data' : esc(mesesTxt(s.meses))}</span>${acao || '<span></span>'}</div>
        <div class="d3m-d-ct-mais"><p>Saiu em ${esc(dataCurta(s.saida))}${s.saidaFonte === 'ultima_peca' ? ' (estimada pela última peça)' : ''}${s.tipo ? ` · ${esc(TIPOS()[s.tipo])}` : ''} · ${esc(motivoDaSaida(s))}</p>
          ${s.detalhe || s.motivoLivre ? `<p>“${esc(s.detalhe || s.motivoLivre)}”</p>` : ''}
          ${formAqui ? `<div class="v2k-acao-form">${porQueHtml(s)}${formChurn(s)}</div>` : `<div class="d3m-d-ct-acoes">${pode ? btnFolha(s.classificado ? 'Editar motivo' : 'Classificar a saída', `data-vc-form-abrir="churn" data-vc-cli="${esc(s.id)}" data-vc-onde="lista"`, true) : ''}${btnFolha('Abrir a ficha', `data-vc-cliente="${esc(s.nome)}"`)}</div>`}</div></li>`;
  }
  function abaChurn() {
    const sv = estado.servidor, din = veDinheiro();
    const ajuda = `<div class="vc-ajuda" role="note"><b>Como o churn é contado</b>
      <p>Quem saiu (pela desativação no cadastro), com tipo e motivo. Taxa = saídas ÷ clientes ativos no começo do período.${din ? ' Receita perdida = a receita mensal de quem saiu.' : ''}</p>
      <p>${esc(COMO_CONTA_CHURN)} A retenção mostra quantos de cada mês de entrada seguiam ativos depois de 1, 2, 3, 6 e 12 meses.</p></div>`;
    if (sv?.aguardando) return { topo: { sub: 'quem saiu, por quê e quanto tempo ficou' }, ajuda,
      corpo: `<div class="d3m-d-ct" data-tela="ct-churn"><div class="d3m-d-ct-main"><section class="d3m-d-folha d3m-d-ct-folha" aria-label="Quem saiu"><div class="d3m-d-cab"><h3>Quem saiu</h3></div>${vazioM('O churn ainda não está disponível. Quando estiver, quem saiu e por quê aparecem aqui.')}</section>
        ${avisoM('O churn ainda não está disponível.', 'Quando estiver, quem saiu, por quê e quanto tempo ficou aparecem aqui.')}</div>
        <aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${larMq(AGENTE_CHURN, 'churn', '', 'O churn ainda não está disponível', 'Quando estiver, quem saiu e por quê aparecem aqui.', '')}</aside></div>` };
    if (!sv?.clientes) return { topo: null, ajuda, corpo: `<section class="d3m-d-folha d3m-d-ct-folha so">${vazioM(esc(estado.erro || 'A base de clientes não carregou.'), btnFolha('Tentar de novo', 'data-vc-recarregar', true))}</section>` };
    const base0 = clientesM(), registros = semValor(sv.churn?.registros || [], 'receita_mensal');
    const r = S().churn({ clientes: base0, registros, contratos: contratosM(), tipo: estado.tipo, mes: estado.mes });
    const c = S().cohort({ clientes: base0, hoje: hoje() });
    const pode = podeChurn(), periodo = esc(r.periodo.rotulo), espia = (chave) => (din ? ` data-espiar="${chave}"` : '');
    // Ativos hoje = os mesmos ativos das outras telas (auditoria 15/11, item 38): o cadastro com a regra única; sem cadastro
    // carregado, a base do servidor.
    const ativoCad = window.VybeDono?.util?.ativoNoCadastro || ((x) => x && x.ativo);
    const ativosHoje = cadastro().length ? cadastro().filter((x) => x && ativoCad(x)).length : sv.clientes.filter((x) => x && x.id != null && x.ativo).length;
    const termo = termoDaBusca(), naBusca = (s) => !termo || semAcento(s.nome).includes(termo);
    // "Registrar saída" (no "Mais") classifica uma saída que já aparece aqui.
    const semClass = r.todas.filter((s) => !s.classificado), saidasParaRegistrar = [...semClass, ...r.todas.filter((s) => s.classificado)];
    const emRegistro = estado.form?.tipo === 'churn' && estado.form.onde === 'registrar' ? r.todas.find((s) => s.id === estado.form.id) : null;
    const registrar = estado.registrar === estado.aba && pode && r.todas.length ? `<section class="d3m-d-folha d3m-d-ct-registrar v2k-registrar" aria-label="Registrar saída">
      ${emRegistro ? `<p class="d3m-d-ct-quem"><b>${esc(emRegistro.nome)}</b> · saiu em ${esc(dataCurta(emRegistro.saida))}</p>${porQueHtml(emRegistro)}${formChurn(emRegistro)}`
        : `<label class="vc-campo"><span>Cliente que saiu</span><select data-vc-registrar-cli>${saidasParaRegistrar.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)} · saiu em ${esc(dataCurta(s.saida))}${s.classificado ? '' : ' · sem motivo'}</option>`).join('')}</select></label>
        ${btnFolha('Cancelar', 'data-vc-registrar')}${btnFolha('Continuar', 'data-vc-registrar-ir="churn"', true)}`}</section>` : '';
    const nomeMes = (iso) => (S().util?.nomeDoMes ? S().util.nomeDoMes(String(iso).slice(0, 7)).split(' ')[0] : diaMes(iso));
    const dePeriodo = estado.tipo === 'anual' ? `de ${periodo}` : `de ${esc(nomeMes(`${estado.mes}-01`))}`;
    // O laranja diz o que pede ação, com o botão que faz isso (auditoria 15/11, itens 3 e 27): primeiro a saída sem motivo,
    // depois o cliente que pode sair (risco alto na Saúde); sem ação, o resumo das saídas.
    const semMotivoP = r.lista.filter((s) => !s.classificado), primeiroSem = semMotivoP[0];
    const riscoSaida = (estado.saude?.clientes || []).filter((x) => x.risco === 'alto' && x.id).sort((a, b) => a.score - b.score);
    const laranja = primeiroSem ? larMq(AGENTE_CHURN, 'saída sem motivo', semMotivoP.length, `${semMotivoP.length === 1 ? 'saída' : 'saídas'} ${dePeriodo} sem motivo`, `${esc(primeiroSem.nome)} saiu em ${esc(diaMes(primeiroSem.saida))}. Sem o motivo, a retenção não aprende.`,
        `${pode ? btnLar('Registrar o motivo', `data-vc-form-abrir="churn" data-vc-cli="${esc(primeiroSem.id)}" data-vc-onde="lista"`) : ''}${btnLar('Abrir a ficha', `data-vc-cliente="${esc(primeiroSem.nome)}"`, pode)}`)
      : riscoSaida.length ? larMq(AGENTE_CHURN, 'pode sair', riscoSaida.length, riscoSaida.length === 1 ? 'cliente em risco alto' : 'clientes em risco alto', `${esc(riscoSaida[0].nome)} está com nota ${riscoSaida[0].score} na Saúde da carteira.`, btnLar('Abrir o cliente', `data-vc-cliente="${esc(riscoSaida[0].nome)}"`))
      : r.saidas ? larMq(AGENTE_CHURN, 'saídas', r.saidas, `${r.saidas === 1 ? 'saída' : 'saídas'} em ${periodo}`, `${din && r.receitaPerdida ? `${esc(reaisCurto(r.receitaPerdida))} por mês. ` : ''}${r.principalMotivo ? `Mais por ${esc(String(r.principalMotivo.rotulo).toLowerCase())}.` : 'Todas com motivo.'}`, '')
      : r.todas.length ? larMq(AGENTE_CHURN, 'sem saída', '', `Ninguém saiu em ${periodo}`, `${plural(r.todas.length, 'saída', 'saídas')} no histórico.`, estado.histCh ? '' : btnLar('Ver o histórico', 'data-vc-hist-ch'))
      : larMq(AGENTE_CHURN, 'sem saída', '', 'Nenhum cliente saiu até agora', 'Quem for desativado no cadastro aparece aqui.', '');
    // Os três números em folha.
    const serie = serieDosMeses();
    if (serie) guardarBase();
    const seis = serie ? serie.meses.slice(-6) : [], vt = r.variacao.taxa;
    const noPeriodo = estado.tipo === 'anual' ? `em ${periodo}` : `em ${esc(nomeMes(`${estado.mes}-01`))}`;
    const porTipo = Object.keys(TIPOS()).map((k) => [k, r.lista.filter((s) => s.tipo === k).length]), semTipo = r.lista.filter((s) => !s.tipo).length;
    const numeros = `<div class="d3m-d-nums">${numMq({ rotulo: `Taxa de churn ${noPeriodo}`, selo: r.saidas ? 'r' : '', ic: ICQ.alerta, valor: r.taxa == null ? '—' : `${virgula(r.taxa)}%`, tom: r.saidas ? 'r' : '',
        sub: `${r.taxa == null ? 'sem base no período' : `${plural(r.saidas, 'saída', 'saídas')} em ${plural(r.ativosNoInicio, 'cliente', 'clientes')}`}${vt && vt.direcao !== 'igual' ? ` · ${vt.direcao === 'sobe' ? '+' : '−'}${esc(virgula(Math.abs(vt.delta)))} p.p.` : ''}`, graf: miniMq(seis.map((p) => Number(p.saidas) || 0), r.saidas ? 'r' : '') })}
      ${din ? numMq({ rotulo: 'Receita perdida', ic: ICQ.dinheiro, valor: reaisCurto(r.receitaPerdida), sub: `por mês, ${r.saidas ? `com ${r.saidas === 1 ? 'a saída' : `as ${r.saidas} saídas`} ${dePeriodo}` : `sem saída em ${periodo}`}${r.semReceita ? ` · ${r.semReceita} sem valor` : ''}` })
        : numMq({ rotulo: 'Saídas', ic: ICQ.sai, valor: String(r.saidas), sub: [...porTipo.filter(([, n]) => n).map(([k, n]) => `${n} ${TIPO_CURTO[k] || k}`), semTipo ? `${semTipo} sem tipo` : ''].filter(Boolean).join(' · ') || 'ninguém no período' })}
      ${numMq({ rotulo: 'Tempo até sair', selo: 'negocio', ic: ICQ.relogio, valor: r.tempoMedioMeses == null ? '—' : plural(Math.round(r.tempoMedioMeses), 'mês', 'meses'), sub: r.tempoMedioMeses == null ? 'sem data de entrada' : `média de casa ${r.saidas === 1 ? 'da saída' : `das ${r.saidas} saídas`} ${dePeriodo}` })}</div>`;
    // A lista: no período (ou o histórico inteiro), pela ficha, pela busca e pela ordem.
    const base = estado.histCh ? r.todas : r.lista;
    const FICHAS = [['todas', 'Todas', () => true], ...Object.keys(TIPOS()).map((k) => [k, TIPO_FICHA[k] || TIPOS()[k], (s) => s.tipo === k]), ['sem', 'Sem motivo', (s) => !s.classificado, 'a']];
    if (!FICHAS.some(([k]) => k === estado.filtroCh)) estado.filtroCh = 'todas';
    const passa = FICHAS.find(([k]) => k === estado.filtroCh)[2];
    let lista = base.filter((s) => passa(s) && naBusca(s));
    const comForm = estado.form?.tipo === 'churn' && estado.form.onde !== 'registrar' ? r.todas.find((s) => s.id === estado.form.id) : null;
    if (comForm && !lista.includes(comForm)) lista = [comForm, ...lista];
    const ORDENS = [['recente', 'Mais recente primeiro'], ...(din ? [['receita', 'Maior receita primeiro']] : []), ['nome', 'Nome A–Z']];
    if (!ORDENS.some(([k]) => k === estado.ordem.churn)) estado.ordem.churn = 'recente';
    if (estado.ordem.churn === 'receita') lista = [...lista].sort((a, b) => (b.receita ?? -1) - (a.receita ?? -1));
    else if (estado.ordem.churn === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const filtrando = Boolean(termo) || estado.filtroCh !== 'todas';
    const quemSaiu = `<section class="d3m-d-folha d3m-d-ch-quem${comForm ? ' com-form' : ''}" aria-label="Quem saiu"><div class="d3m-d-cab"><h3>${estado.histCh ? 'Quem já saiu' : 'Quem saiu'} <small>· ${base.length} ${estado.histCh ? 'no histórico' : `em ${periodo}`}</small></h3>
        ${segM('Filtrar as saídas', FICHAS.map(([k, rot, f2, tom]) => [k, rot, base.filter(f2).length, tom]).filter(([k, , n]) => n || ['todas', 'cancelamento', 'nao_renovou', 'sem'].includes(k)).map(([k, rot, n, tom]) => [`data-vc-filtro-ch="${k}"`, rot, n, estado.filtroCh === k, tom]))}
        ${r.todas.length ? `<button type="button" class="d3m-d-elo" data-vc-hist-ch aria-pressed="${estado.histCh}">${estado.histCh ? `só ${periodo}` : 'mostrar o histórico'}</button>` : ''}</div>
        ${lista.length ? `<div class="d3m-d-ch-lin d3m-d-ch-cabl${din ? '' : ' sem-valor'}" aria-hidden="true"><span>Cliente</span><span>Saiu em</span><span>Como</span><span>Motivo</span>${din ? '<span class="d3m-d-ch-v">Por mês</span>' : ''}<span class="d3m-d-ch-v">Ficou</span><span></span></div>
          <ol class="d3m-d-ct-rolo">${lista.map((s) => linhaSaidaM(s, { din })).join('')}</ol>`
          : vazioM(filtrando ? 'Nenhuma saída neste filtro.' : estado.histCh ? 'Ninguém saiu até agora.' : `Ninguém saiu em ${periodo}.`, filtrando ? btnFolha('Ver todas', 'data-vc-filtro-ch="todas" data-vc-limpar', true) : !estado.histCh && r.todas.length ? btnFolha('Mostrar o histórico', 'data-vc-hist-ch') : '')}</section>`;
    // Saídas por mês (barras dos últimos seis meses), os motivos do histórico inteiro ou a retenção por mês de entrada.
    const VISTAS = [['meses', 'Por mês'], ['motivos', 'Motivos'], ['retencao', 'Retenção']];
    if (!VISTAS.some(([k]) => k === estado.vistaCh)) estado.vistaCh = 'meses';
    const motivosDe = (fonte) => [...r.porMotivo.map((m) => ({ rotulo: m.rotulo, vezes: fonte.filter((s) => s.motivo === m.motivo).length })).sort((a, b) => b.vezes - a.vezes),
      { rotulo: 'Sem motivo registrado', vezes: fonte.filter((s) => !s.motivo).length, semMotivo: true }].filter((m) => m.vezes);
    const motivosHtml = (fonte, nada) => { const lista2 = motivosDe(fonte), topoM2 = Math.max(1, ...lista2.map((m) => m.vezes));
      return lista2.length ? `<div class="d3m-d-ch-mots">${lista2.map((m) => `<p class="d3m-d-ch-motl${m.semMotivo ? ' a' : ''}"><span>${esc(m.rotulo)}</span><span class="d3m-d-ch-barra"><i style="--v:${Math.round((m.vezes / topoM2) * 100)}%"></i></span><b>${m.vezes}</b></p>`).join('')}</div>` : vazioM(nada); };
    const barrasDe = (campoM, titulo) => { const mx = Math.max(1, ...seis.map((p) => Number(p[campoM]) || 0));
      return `<div class="d3m-d-ch-barras" role="img" aria-label="${esc(`${titulo}: ${seis.map((p) => `${mesCurto(p.mes)} ${Number(p[campoM]) || 0}`).join(', ')}`)}">${seis.map((p) => { const n = Number(p[campoM]) || 0;
        return `<span${n ? espia(`carteira:mes:${campoM}:${esc(p.mes)}`) : ''}><b>${n}</b><i${n ? ` class="on" style="--n:${(n / mx).toFixed(2)}"` : ''}></i><small${p.agora ? ' class="agora"' : ''}>${mesCurto(p.mes)}</small></span>`; }).join('')}</div>`; };
    const temMes = seis.some((p) => Number(p.saidas) > 0 || Number(p.novos) > 0);
    const vista = estado.vistaCh === 'retencao' ? `<div class="d3m-d-ch-cohort">${cohortHtml(c)}</div>`
      : estado.vistaCh === 'motivos' ? motivosHtml(r.todas, 'Nenhuma saída até agora.')
      : temMes ? barrasDe('saidas', 'Saídas por mês') : vazioM('Ninguém saiu nem entrou nestes meses.');
    const tituloVista = estado.vistaCh === 'retencao' ? 'Retenção por mês de entrada' : estado.vistaCh === 'motivos' ? 'Motivos no histórico' : 'Saídas por mês';
    const totalSerie = serie ? serie.meses.reduce((t, p) => t + (Number(p.saidas) || 0), 0) : 0;
    const peDaVista = serie ? `${totalSerie ? `${plural(totalSerie, 'saída', 'saídas')} em ${serie.meses.length} meses.` : `Ninguém saiu nos últimos ${serie.meses.length} meses.`} “Retenção” mostra quantos ficaram, por mês de entrada.` : '“Retenção” mostra quantos ficaram, por mês de entrada.';
    const folhaVista = `<section class="d3m-d-folha d3m-d-ch-vista" aria-label="${esc(tituloVista)}"><div class="d3m-d-cab"><h3>${esc(tituloVista)}</h3>${segM('Ver', VISTAS.map(([k, rot]) => [`data-vc-vista-ch="${k}"`, rot, null, estado.vistaCh === k]))}</div>
        <div class="d3m-d-ch-corpo">${vista}</div><p class="d3m-d-ct-leitor">${esc(peDaVista)}</p></section>`;
    const folhaMotivos = `<section class="d3m-d-folha d3m-d-ch-porque" aria-label="Por que saíram"><div class="d3m-d-cab"><h3>Por que saíram</h3><small>${estado.histCh ? 'histórico' : periodo}</small></div>
        <div class="d3m-d-ch-corpo">${motivosHtml(base, estado.histCh ? 'Nenhuma saída até agora.' : `Nenhuma saída em ${periodo}.`)}</div></section>`;
    // A coluna de consulta: o laranja, quem está em risco agora e a retenção por ano de entrada.
    const emRisco = riscoSaida.filter(naBusca).slice(0, 4);
    const riscoM = `<section class="d3m-cons" aria-label="Em risco agora"><div class="d3m-cons-cab"><b>Em risco agora</b><span>${riscoSaida.length ? 'risco alto na Saúde' : 'ninguém'}</span></div>
      ${emRisco.map((x) => `<button type="button" class="d3m-vlin" data-vc-cliente="${esc(x.nome)}" aria-label="${esc(`${x.nome}, nota ${x.score}`)}">${avM(x.nome)}<span class="d3m-vnome"><b>${esc(x.nome)}</b></span><b class="d3m-vn">${x.score}</b>${ICQ.seta}</button>`).join('') || '<p class="d3m-vvazio">Nenhum cliente em risco alto.</p>'}</section>`;
    const anos = new Map();
    for (const x of base0) { const a = String(x?.entrada || '').slice(0, 4); if (!x || x.id == null || !/^\d{4}$/.test(a)) continue; const o = anos.get(a) || { n: 0, ficam: 0 }; o.n += 1; if (x.ativo) o.ficam += 1; anos.set(a, o); }
    const porAno = [...anos.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-4);
    const retencaoM = `<section class="d3m-cons" aria-label="Retenção por ano de entrada"><div class="d3m-cons-cab"><b>Retenção</b><span>por ano de entrada</span></div>
      ${porAno.length ? `<button type="button" class="d3m-d-ch-ret" data-vc-vista-ch="retencao" aria-label="Retenção por ano de entrada: ${esc(porAno.map(([a, o]) => `${a}, ${o.ficam} de ${o.n}`).join('; '))}. Abrir a retenção por mês">${porAno.map(([a, o]) => { const p = Math.round((o.ficam / o.n) * 100);
        return `<span title="${o.ficam} de ${o.n} seguem ativos"><small>${a}</small><span class="d3m-vbarra${p < 50 ? ' r' : p < 75 ? ' a' : ''}"><i style="--v:${p}%"></i></span><b>${p}%</b></span>`; }).join('')}</button>` : '<p class="d3m-vvazio">Sem data de entrada ainda.</p>'}</section>`;
    const aviso = sv.churn?.disponivel ? '' : avisoM('A classificação das saídas ainda não está disponível.', 'As saídas já aparecem pela desativação do cliente; o motivo de cada uma passa a ser guardado quando estiver.');
    const topo = { sub: `quem saiu, por quê e ${din ? 'quanto levou' : 'quanto tempo ficou'} · ${periodo} · ${plural(ativosHoje, 'ativo', 'ativos')} hoje`, ferr: buscaM('Buscar saída por cliente'),
      mais: [`<button type="button" role="menuitem" data-vc-filtros aria-expanded="${estado.filtros}">Período e ordem</button>`, ...(r.todas.length ? [`<button type="button" role="menuitem" data-vc-hist-ch>${estado.histCh ? `Só ${periodo}` : 'Mostrar o histórico'}</button>`] : []),
        ...(pode && r.todas.length ? [`<button type="button" role="menuitem" data-vc-registrar aria-expanded="${estado.registrar === estado.aba}">Registrar saída</button>`] : [])], acao: '' };
    return { topo, ajuda, corpo: `<div class="d3m-d-ct d3m-d-ch${comForm ? ' com-form' : ''}" data-tela="ct-churn"><div class="d3m-d-ct-main">${estado.filtros ? periodoM('churn', ORDENS) : ''}${registrar}${numeros}
        <div class="d3m-d-ch-meio">${folhaVista}${folhaMotivos}</div>${quemSaiu}${aviso}</div>
      <aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${laranja}${riscoM}${retencaoM}</aside></div>` };
  }
  // Como o churn é contado: vai para "Como funciona".
  const COMO_CONTA_CHURN = 'Saída = desativação no cadastro (a data do registro de churn, quando houver). Entrada = início do contrato; sem ele, a data do cadastro.';
  const churnTemSaida = () => (estado.servidor?.clientes || []).some((c) => c && c.id != null && c.saida);
  // Mensal/Anual só muda a conta quando existe alguma saída; o mês anda a janela dos gráficos, que pede entrada ou saída com data.
  const churnTemHistorico = () => churnTemSaida() || (estado.servidor?.clientes || []).some((c) => c && c.id != null && c.entrada);
  function guardarBase() {
    espiarCarteira.base = estado.servidor?.clientes || [];
    espiarCarteira.listaContratos = listaContratos();
  }

  // ---------- Contratos ----------
  // Como o mês a mês é contado: vai para "Como funciona".
  function comoContaMesAMes(s) {
    return `Cada mês na data do último dia (o mês corrente, hoje). Ativos = entraram até ali e não tinham saído${s?.semEntrada ? ` (${plural(s.semEntrada, 'cliente sem data de entrada conta', 'clientes sem data de entrada contam')} como antigo)` : ''}.${veDinheiro() ? ' Ticket = receita mensal ativa ÷ clientes ativos com valor.' : ''} As saídas por mês ficam na tela Churn.`;
  }
  const CAMPOS_MES_A_MES = ['ativos', 'novos', 'ltvMedio', 'ticketMedio'];
  const mesAMesTemDado = (s) => Boolean(s && s.meses.some((p) => CAMPOS_MES_A_MES.some((c) => Number(p[c]) > 0)));
  // Mensal/Anual e o mês só mudam algo onde há dado (o cabeçalho antigo, fora do quadro).
  function periodoMudaAlgo() {
    if (estado.aba === 'churn') return churnTemHistorico();
    if (estado.aba !== 'contratos') return false;
    try { return Boolean(contratosAgora()?.linhas?.length); } catch { return false; }
  }
  function formContrato(l) {
    const f = estado.form;
    if (!f || f.tipo !== 'contrato' || f.id !== l.id) return '';
    return `<form class="vc-form" data-vc-form="contrato" data-vc-cli="${esc(l.id)}">
      <label class="vc-campo"><span>Valor mensal (R$)</span><input type="number" name="valor_mensal" min="0" step="0.01" inputmode="decimal" value="${l.valor ?? ''}"></label>
      <label class="vc-campo"><span>Início</span><input type="date" name="inicio" value="${esc(l.inicio || '')}"></label>
      <label class="vc-campo"><span>Renovação</span><input type="date" name="renovacao" value="${esc(l.renovacao || '')}"></label>
      <label class="vc-campo"><span>Status</span><select name="status">${Object.entries(STATUS_CONTRATO).map(([k, [r]]) => `<option value="${k}"${(l.status || 'ativo') === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="vc-campo largo"><span>Observação</span><textarea name="observacao" maxlength="1000" rows="2">${esc(l.observacao)}</textarea></label>
      <div class="vc-linha-acoes"><span class="vc-espaco"></span>${secundario('Cancelar', 'data-vc-form-cancelar')}<button type="submit" class="vc-acao">Salvar contrato</button></div></form>`;
  }
  // Topo da aba quando o Vybe Finanças está ligado: de onde vêm os contratos e quem ficou sem par.
  function finContratosHtml(f) {
    if (!f) return '';
    const ligados = (f.contratos || []).filter((c) => c.cliente_id).length, sem = f.ligacao?.sem_par?.length || 0, falta = f.ligacao?.vybe_sem_par?.length || 0;
    return `<section class="vc-secao"><div class="vc-secao-topo"><h3>Contratos do Vybe Finanças</h3>${etiqueta('fonte: Vybe Finanças', 'u4')}</div>
      ${resumo([numero((f.contratos || []).length, String((f.contratos || []).length), ' no Finanças', { espiar: 'financas:carteira:contratos' }), numero(ligados, String(ligados), ' ligados a clientes do Vybe OS'),
        numero(sem, String(sem), ' no Finanças sem par no Vybe OS', { tom: sem ? 'atencao' : '', espiar: 'financas:carteira:sempar' }), numero(falta, String(falta), ' ativos no Vybe OS faltando no Finanças', { tom: falta ? 'atencao' : '', espiar: 'financas:carteira:faltafin' })])}
      ${nota('Ligação pelo CNPJ quando os dois cadastros têm; senão pelo nome (sem acento, sem ltda/me/eireli). Quem ficou sem par: confira o nome ou o CNPJ no cadastro do cliente.')}</section>`;
  }
  const podeContratos = () => Boolean(estado.servidor?.pode?.contratos && estado.servidor?.contratos?.disponivel && veDinheiro());
  const contratoDaFin = (id) => window.VybeFinancas?.contratoDoCliente?.(id) || null;
  // A trilha do contrato: do início à renovação, quanto já passou. Vermelho venceu, âmbar renova em 30 dias.
  function trilha(l) {
    if (!l.temContrato) return { pct: 0, cor: '#B42318', texto: 'sem contrato' };
    if (l.status === 'encerrado') return { pct: 100, cor: '#C9C2B6', texto: 'contrato encerrado' };
    if (!l.inicio || !l.renovacao) return { pct: 0, cor: '#11613A', texto: l.renovacao ? `renova em ${dataCurta(l.renovacao)}` : 'sem renovação marcada' };
    const total = Math.max(1, mesesDe(l.inicio, l.renovacao)), passou = l.vencida ? total : hoje() < l.inicio ? 0 : Math.min(total, mesesDe(l.inicio, hoje()));
    const pct = l.vencida ? 100 : Math.min(100, Math.max(0, Math.round(((Date.parse(hoje()) - Date.parse(l.inicio)) / Math.max(1, Date.parse(l.renovacao) - Date.parse(l.inicio))) * 100)));
    // Direção 3: a trilha "até renovar" em tinta escura, âmbar quando renova em 30 dias, vermelho só quando venceu.
    return { pct, cor: l.vencida ? '#B42318' : l.emBreve ? '#7A4A00' : '#1F1D1A', texto: `${passou} de ${plural(total, 'mês', 'meses')}`, curto: `${passou}/${total}` };
  }
  // Os doze meses da régua da renovação, a partir do mês de hoje: [{ ym, letra }].
  function mesesDaRegua() {
    const [a, m] = hoje().slice(0, 7).split('-').map(Number);
    return Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(a, m - 1 + i, 1)), ym = `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}`; return { ym, letra: mesCurto(ym)[0] || '' }; });
  }
  const mesAA = (iso) => (iso ? `${mesCurto(iso)} ${String(iso).slice(2, 4)}` : '');
  // Em que grupo a linha entra: a renovação venceu ou chega em 30 dias (Agora), tem contrato (Depois) ou falta registrar.
  const grupoCt = (l) => (!l.temContrato ? 'falta' : l.status !== 'encerrado' && (l.vencida || l.emBreve) ? 'agora' : 'depois');
  const ROT_GRUPO_CT = { agora: 'Agora', depois: 'Depois', falta: 'Falta' };
  // A linha do cliente ativo: quando, quem, quanto por mês, desde quando, a régua de doze meses com o mês da renovação e
  // a data. Abre no lugar com o histórico e o que dá para fazer (o formulário de sempre).
  function linhaContratoM(l, { regua, din, rotGrupo }) {
    const chave = `k:${l.id}`, formAqui = estado.form?.tipo === 'contrato' && estado.form.id === l.id && estado.form.onde !== 'registrar';
    const aberto = formAqui || estado.abertos.has(chave), t = trilha(l), fc = contratoDaFin(l.id), pode = !fc && podeContratos(), g = grupoCt(l);
    const [rotStatus] = STATUS_CONTRATO[l.status] || ['Sem contrato'];
    const hist = [l.temContrato ? [l.inicio ? `Início em ${S().util?.nomeDoMes ? S().util.nomeDoMes(l.inicio.slice(0, 7)) : dataCurta(l.inicio)}` : 'Sem data de início', l.renovacao ? `renovação em ${diaMes(l.renovacao)}${l.renovacao.slice(0, 4) !== hoje().slice(0, 4) ? `/${l.renovacao.slice(2, 4)}` : ''}` : 'sem renovação marcada', rotStatus, t.texto].join(' · ') : 'Sem contrato registrado',
      [din ? (l.valor != null ? `${reais(l.valor)} por mês${l.valorDoCadastro ? ' (do cadastro)' : ''}` : 'sem valor mensal') : '', l.mesesLtv != null ? `na casa há ${mesesTxt(l.mesesLtv)}` : 'sem data de entrada', din && l.receitaLtv != null ? `LTV estimado ${reais(l.receitaLtv)}` : ''].filter(Boolean).join(' · ')];
    const daFin = fc ? `<p>${esc(['Vybe Finanças: ' + fc.titulo, fc.assinado_em ? 'assinado em ' + dataCurta(fc.assinado_em) : 'sem data de assinatura', fc.dia_vencimento ? 'vence dia ' + fc.dia_vencimento : '', fc.status, fc.tem_pdf ? 'com PDF' : 'sem PDF'].filter(Boolean).join(' · '))}</p>` : '';
    const acoes = `${pode ? btnFolha(l.temContrato ? 'Abrir o contrato' : 'Registrar contrato', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}" data-vc-onde="lista"`, true) : ''}${pode && l.temContrato ? btnFolha('Mudar a data', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}" data-vc-onde="lista" data-vc-campo="renovacao"`) : ''}${btnFolha('Abrir o cliente', `data-vc-cliente="${esc(l.nome)}"`)}`;
    const mesRenova = l.temContrato && l.status !== 'encerrado' && l.renovacao ? (l.vencida ? regua[0].ym : l.renovacao.slice(0, 7)) : '';
    const reguaHtml = `<span class="d3m-d-ct-regua" aria-hidden="true">${regua.map((q) => (q.ym === mesRenova ? `<i class="on${l.vencida || l.emBreve ? ' r' : ''}">${esc(q.letra)}</i>` : '<i></i>')).join('')}</span>`;
    const renova = !l.temContrato ? `<span class="d3m-d-ct-r${pode ? ' k' : ''}">${pode ? 'Registrar' : 'sem contrato'}</span>` : l.status === 'encerrado' ? '<span class="d3m-d-ct-r q">encerrado</span>'
      : l.vencida ? `<span class="d3m-d-ct-r r">venceu ${esc(diaMes(l.renovacao))}</span>` : l.emBreve ? `<span class="d3m-d-ct-r a">${esc(diaMes(l.renovacao))}</span>`
      : l.renovacao ? `<span class="d3m-d-ct-r">${esc(mesCurto(l.renovacao))} de ${esc(l.renovacao.slice(2, 4))}</span>` : '<span class="d3m-d-ct-r q">sem data</span>';
    return `<li class="d3m-d-ct-li" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}">
        <button type="button" class="d3m-d-ct-lin${din ? '' : ' sem-valor'}" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${l.nome}, ${din ? (l.valor == null ? 'sem valor, ' : `${reais(l.valor)} por mês, `) : ''}${l.temContrato ? t.texto : 'sem contrato'}`)}">
          <span class="d3m-d-ct-g ${g}">${rotGrupo ? esc(ROT_GRUPO_CT[g]) : ''}</span>${avM(l.nome)}<span class="d3m-d-ct-n">${esc(l.nome)}</span>
          ${din ? (l.valor == null ? '<span class="d3m-d-ct-v q">sem valor</span>' : `<b class="d3m-d-ct-v">${esc(reais(l.valor))}</b>`) : ''}
          <span class="d3m-d-ct-d${l.entrada ? '' : ' q'}">${l.entrada ? esc(mesAA(l.entrada)) : 'sem data'}</span>${reguaHtml}${renova}</button>
        <div class="d3m-d-ct-mais">${hist.map((h) => `<p>${esc(h)}</p>`).join('')}${daFin}${l.observacao ? `<p>“${esc(l.observacao)}”</p>` : ''}
          ${formAqui ? `<div class="v2k-acao-form">${formContrato(l)}</div>` : `<div class="d3m-d-ct-acoes">${acoes}</div>`}</div></li>`;
  }
  function abaContratos() {
    const sv = estado.servidor, f = finCarteira(), din = veDinheiro();
    if (sv?.aguardando) return { topo: { sub: 'valor, início e renovação de cada cliente ativo' }, ajuda: '',
      corpo: `<div class="d3m-d-ct" data-tela="ct-contratos"><div class="d3m-d-ct-main"><section class="d3m-d-folha d3m-d-ct-folha" aria-label="Clientes ativos"><div class="d3m-d-cab"><h3>Clientes ativos</h3></div>${vazioM('Os contratos ainda não foram ligados. Quando estiverem, o valor, o início e a renovação de cada cliente aparecem aqui.')}</section>
        ${avisoM('Os contratos ainda não foram ligados.', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente aparecem aqui. Nada se perde até lá.')}</div>
        <aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${larMq(AGENTE_CONTRATOS, 'contratos', '', 'Os contratos ainda não foram ligados', 'Quando estiverem, o valor, o início e a renovação de cada cliente aparecem aqui.', '')}</aside></div>` };
    if (!sv?.clientes) return { topo: null, ajuda: '', corpo: `<section class="d3m-d-folha d3m-d-ct-folha so">${vazioM(esc(estado.erro || 'A base de clientes não carregou.'), btnFolha('Tentar de novo', 'data-vc-recarregar', true))}</section>` };
    const r = S().contratos({ clientes: clientesM(), contratos: contratosM(), hoje: hoje(), tipo: estado.tipo, mes: estado.mes });
    espiarCarteira.contratos = r;
    const pode = podeContratos(), termo = termoDaBusca(), naBusca = (l) => !termo || semAcento(l.nome).includes(termo);
    const serie = serieDosMeses();
    if (serie) guardarBase();
    const espia = (chave) => (din ? ` data-espiar="${chave}"` : '');
    const dicaLtv = `LTV = meses desde o início do contrato (sem contrato, a data de entrada no cadastro) até hoje, só clientes ativos.${din ? ' Receita estimada = valor mensal × meses de casa.' : ''}${r.semDataLtv ? ` ${plural(r.semDataLtv, 'cliente sem data fica', 'clientes sem data ficam')} fora da média.` : ''} Tempo restante = dias até a renovação dos contratos abertos que ainda não venceram${r.restanteMedio ? ` (${plural(r.restanteMedio.contratos, 'contrato', 'contratos')})` : ''}.`;
    const notaFonte = f ? 'Os contratos que estão no Vybe Finanças vêm de lá (início, fim, assinatura, vencimento e PDF) e se alteram no Finanças. Os outros clientes seguem com o registro do Vybe OS, que só quem administra altera.'
      : 'Só o registro do contrato, sem assinatura eletrônica; valor e contrato só quem administra altera.';
    const ajuda = `<div class="vc-ajuda" role="note"><b>Como os contratos funcionam</b>
      <p>${din ? 'Valor mensal, início' : 'Início'}, renovação e status de cada cliente ativo. O que venceu ou renova em 30 dias fica em "Agora"; a régua da linha mostra em que mês dos próximos doze cai a renovação.</p>
      <p>${esc(dicaLtv)}</p><p>${esc(comoContaMesAMes(serie))}</p><p>${esc(notaFonte)}</p></div>${f && din ? `<div class="d3m-d-folha d3m-d-ct-fin">${finContratosHtml(f)}</div>` : ''}`;
    // Topo: "Registrar contrato" escolhe o cliente e abre o mesmo formulário de sempre.
    const fora = (l) => Boolean(contratoDaFin(l.id));
    const candidatos = [...r.linhas.filter((l) => !l.temContrato && !fora(l)), ...r.linhas.filter((l) => l.temContrato && !fora(l)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))];
    const emRegistro = estado.form?.tipo === 'contrato' && estado.form.onde === 'registrar' ? r.linhas.find((l) => l.id === estado.form.id) : null;
    const registrar = estado.registrar === estado.aba && pode && candidatos.length ? `<section class="d3m-d-folha d3m-d-ct-registrar v2k-registrar" aria-label="Registrar contrato">
      ${emRegistro ? `<p class="d3m-d-ct-quem"><b>${esc(emRegistro.nome)}</b> · ${emRegistro.temContrato ? 'contrato registrado: os campos abaixo substituem o atual' : 'sem contrato ainda'}</p>${formContrato(emRegistro)}`
        : `<label class="vc-campo"><span>Cliente</span><select data-vc-registrar-cli>${candidatos.map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}${l.temContrato ? '' : ' · sem contrato'}</option>`).join('')}</select></label>
        ${btnFolha('Cancelar', 'data-vc-registrar')}${btnFolha('Continuar', 'data-vc-registrar-ir="contrato"', true)}`}</section>` : '';
    const abertos = r.linhas.filter((l) => l.temContrato && l.status !== 'encerrado').length, comContrato = r.linhas.filter((l) => l.temContrato).length;
    const semCt = r.linhas.filter((l) => !l.temContrato), breve = r.emBreve.length, vencidas = r.vencidas.length;
    // O laranja do Vorcaro: a renovação que venceu ou chega em 30 dias; sem ela, quem está sem contrato; sem nada, o que entra por mês.
    const pedem = [...r.vencidas, ...r.emBreve], prox = pedem[0], emJogo = pedem.reduce((t, l) => t + (l.valor || 0), 0);
    const quando = (l) => `${esc(l.nome)} ${l.vencida ? 'venceu em' : 'em'} ${esc(diaMes(l.renovacao))}`;
    const laranja = !r.linhas.length ? larMq(AGENTE_CONTRATOS, 'contratos', '', 'Nenhum cliente ativo no cadastro', 'Quem entra no cadastro como ativo aparece aqui.', '')
      : prox ? larMq(AGENTE_CONTRATOS, vencidas ? 'renovação vencida' : 'renovação chegando', pedem.length, vencidas === pedem.length ? (pedem.length === 1 ? 'renovação vencida' : 'renovações vencidas') : pedem.length === 1 ? 'contrato renova em 30 dias' : `contratos ${vencidas ? 'venceram ou renovam' : 'renovam'} em 30 dias`,
        `${pedem.slice(0, 2).map(quando).join(' e ')}${pedem.length > 2 ? ` e mais ${pedem.length - 2}` : ''}${din && emJogo ? `: <span${espia('carteira:contratos:breve')}>${esc(reais(emJogo))} por mês</span>` : ''}.`,
        `${btnLar(`Abrir ${prox.nome}`, `data-vc-abrir="k:${esc(prox.id)}" data-vc-focar="linha"`)}${pedem.length > 1 ? btnLar(`Ver os ${pedem.length}`, 'data-vc-filtro-ct="breve"', true) : ''}`)
      : semCt.length ? larMq(AGENTE_CONTRATOS, 'sem contrato', semCt.length, semCt.length === 1 ? 'cliente ativo sem contrato' : 'clientes ativos sem contrato', `${semCt.slice(0, 2).map((l) => esc(l.nome)).join(' e ')}${semCt.length > 2 ? ` e mais ${semCt.length - 2}` : ''}. Nenhuma renovação em 30 dias.`,
        btnLar(semCt.length === 1 ? 'Ver quem' : `Ver os ${semCt.length}`, 'data-vc-filtro-ct="sem"'))
      : larMq(AGENTE_CONTRATOS, 'contratos em dia', din && r.receita ? reaisCurto(r.receita) : abertos, din && r.receita ? `por mês em ${plural(abertos, 'contrato', 'contratos')}` : abertos === 1 ? 'contrato em dia' : 'contratos em dia', 'Nenhuma renovação nos próximos 30 dias.', '');
    // Fichas e a lista, pela ficha, pela busca e pela ordem.
    const FICHAS = [['todos', 'Todos', () => true], ['breve', vencidas ? 'Vencidas e em 30 dias' : 'Renovam em 30 dias', (l) => l.emBreve || l.vencida, 'a'], ['sem', 'Sem contrato', (l) => !l.temContrato, 'a']];
    if (!FICHAS.some(([k]) => k === estado.filtroCt)) estado.filtroCt = 'todos';
    const [, , passaFicha] = FICHAS.find(([k]) => k === estado.filtroCt);
    let lista = r.linhas.filter((l) => passaFicha(l) && naBusca(l));
    const comForm = estado.form?.tipo === 'contrato' && estado.form.onde !== 'registrar' ? r.linhas.find((l) => l.id === estado.form.id) : null;
    if (comForm && !lista.includes(comForm)) lista = [comForm, ...lista];
    const ORDENS = [['renovacao', 'Renovação mais próxima'], ...(din ? [['valor', 'Maior valor primeiro']] : []), ['nome', 'Nome A–Z']];
    if (!ORDENS.some(([k]) => k === estado.ordem.contratos)) estado.ordem.contratos = 'renovacao';
    const porGrupo = estado.ordem.contratos === 'renovacao';
    if (estado.ordem.contratos === 'valor') lista = [...lista].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    else if (estado.ordem.contratos === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    else { const peso = { agora: 0, depois: 1, falta: 2 }; lista = [...lista].sort((a, b) => peso[grupoCt(a)] - peso[grupoCt(b)]); }
    const regua = mesesDaRegua(), filtrando = Boolean(termo) || estado.filtroCt !== 'todos';
    let grupoAntes = '';
    const linhas = lista.map((l) => { const g = grupoCt(l), rotGrupo = porGrupo && g !== grupoAntes; grupoAntes = g; return linhaContratoM(l, { regua, din, rotGrupo }); }).join('');
    const ltvMeses = r.ltvMedio == null ? null : Math.round(r.ltvMedio), comLtv = r.linhas.length - r.semReceitaLtv;
    const olho = `<div class="d3m-d-pk-olho"><small>De olho</small>${din ? `<span><b>${esc(reaisCurto(r.receita))}</b> em contratos, por mês</span><span><b>${r.ticketMedio == null ? '—' : esc(reais(Math.round(r.ticketMedio)))}</b> ticket</span>` : `<span><b>${comContrato}</b> com contrato</span>`}
        <span${r.receitaLtv != null ? espia('carteira:ltv:receita') : ''}${din && r.receitaLtv != null ? ` title="${esc(`LTV médio ${reaisCurto(r.receitaLtv / Math.max(1, comLtv))}`)}"` : ''}><b>${ltvMeses == null ? '—' : plural(ltvMeses, 'mês', 'meses')}</b> tempo de casa</span>
        <button type="button" data-vc-filtro-ct="sem" aria-pressed="${estado.filtroCt === 'sem'}"><b${semCt.length ? ' class="a"' : ''}>${semCt.length}</b> sem contrato</button></div>`;
    const cabLin = `<div class="d3m-d-ct-lin d3m-d-ct-cabl${din ? '' : ' sem-valor'}" aria-hidden="true"><span></span><span></span><span>Cliente</span>${din ? '<span class="d3m-d-ct-v">Por mês</span>' : ''}<span>Desde</span><span>${esc(mesAA(`${regua[0].ym}-01`))} até ${esc(mesAA(`${regua[11].ym}-01`))}</span><span class="d3m-d-ct-r">Renova</span></div>`;
    const novosN = r.novos.length, mesNome = S().util?.nomeDoMes ? S().util.nomeDoMes(estado.mes).split(' ')[0] : 'no mês';
    const folhaLista = `<section class="d3m-d-folha d3m-d-ct-folha" aria-label="Clientes ativos"><div class="d3m-d-cab"><h3>${plural(r.linhas.length, 'cliente ativo', 'clientes ativos')} <small>· ${porGrupo ? 'a renovação mais próxima primeiro' : estado.ordem.contratos === 'valor' ? 'o maior valor primeiro' : 'de A a Z'}</small></h3>
        ${segM('Filtrar os clientes', FICHAS.map(([k, rot, f2, tom]) => [`data-vc-filtro-ct="${k}"`, rot, r.linhas.filter(f2).length, estado.filtroCt === k, tom]))}</div>
        ${lista.length ? `${cabLin}<ol class="d3m-d-ct-rolo">${linhas}</ol>` : vazioM(filtrando ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente ativo no cadastro. Quem entra no cadastro como ativo aparece aqui.', filtrando ? btnFolha('Ver todos', 'data-vc-filtro-ct="todos" data-vc-limpar', true) : '')}
        ${olho}</section>`;
    // Mês a mês: uma série de cada vez (ativos, novos, LTV ou ticket), os últimos doze meses; abre no lugar da lista.
    const SERIES = [['ativos', 'Ativos', String], ['novos', 'Novos', String], ['ltvMedio', 'LTV', (x) => `${virgula(x)} meses`], ...(din ? [['ticketMedio', 'Ticket', (x) => reais(x)]] : [])];
    if (!SERIES.some(([k]) => k === estado.serieCt)) estado.serieCt = 'ativos';
    const [campo, rotSerie, fmt] = SERIES.find(([k]) => k === estado.serieCt);
    const pontos = serie ? serie.meses.slice(-12) : [], valores = pontos.map((p) => Number(p[campo]) || 0), ultimo = pontos.at(-1), primeiroP = pontos[0];
    const delta = ultimo && primeiroP ? (Number(ultimo[campo]) || 0) - (Number(primeiroP[campo]) || 0) : 0;
    const folhaMeses = `<section class="d3m-d-folha d3m-d-ct-folha d3m-d-ct-meses" aria-label="Mês a mês"><div class="d3m-d-cab"><h3>Mês a mês <small>· ${esc(rotSerie.toLowerCase())}, ${pontos.length ? `${pontos.length} meses` : 'sem data ainda'}</small></h3>
        ${segM('Série', SERIES.map(([k, rot]) => [`data-vc-serie-ct="${k}"`, rot, null, estado.serieCt === k]))}<button type="button" class="d3m-d-elo" data-vc-vista-ct="lista">Voltar aos clientes</button></div>
        ${!mesAMesTemDado(serie) ? vazioM('Sem data de entrada ainda.') : `<div class="d3m-d-ct-serie"><p><b class="d3m-d-numero">${esc(ultimo[campo] == null ? '—' : fmt(ultimo[campo]))}</b>${campo === 'ativos' || campo === 'novos' ? `<span class="${delta >= 0 ? 'g' : 'r'}">${delta >= 0 ? '+' : '−'}${Math.abs(delta)} em ${pontos.length} meses</span>` : ''}</p>
          ${d3Linha(valores, { largura: 720, altura: 220, rotulo: `${rotSerie} mês a mês: ${pontos.map((p) => `${mesCurto(p.mes)} ${p[campo] == null ? 'sem dado' : fmt(p[campo])}`).join(', ')}` })}
          <div class="d3m-d-ct-eixo" aria-hidden="true">${pontos.map((p) => `<span${p.agora ? ' class="agora"' : ''}${campo === 'novos' && Number(p.novos) ? espia(`carteira:mes:novos:${esc(p.mes)}`) : ''}>${mesCurto(p.mes)}</span>`).join('')}</div></div>`}</section>`;
    // A coluna de consulta: o laranja, os clientes ativos em doze meses e o "Abrir".
    const ativos12 = serie ? serie.meses.slice(-12).map((p) => Number(p.ativos) || 0) : [];
    const ativosM = `<section class="d3m-cons" aria-label="Clientes ativos em doze meses"><div class="d3m-cons-cab"><b>Clientes ativos</b><span>${ativos12.length ? `${ativos12.length} meses` : 'sem data ainda'}</span></div>
      <button type="button" class="d3m-d-ct-cartao" data-vc-vista-ct="meses" aria-pressed="${estado.vistaCt === 'meses'}" aria-label="Clientes ativos mês a mês"><span><b>${r.linhas.length}</b><small${novosN ? espia('carteira:novos:periodo') : ''}>${plural(novosN, 'novo', 'novos')} ${estado.tipo === 'anual' ? 'no ano' : `em ${esc(mesNome)}`}</small></span>${miniMq(ativos12)}</button></section>`;
    const abrirM = `<nav class="d3m-cons d3m-d-ct-abrir" aria-label="Abrir"><div class="d3m-cons-cab"><b>Abrir</b><span></span></div>
      <button type="button" class="d3m-vlin" data-vc-ir="churn"><span><b>Churn</b> · quem saiu e por quê</span>${ICQ.seta}</button>
      <button type="button" class="d3m-vlin" data-vc-vista-ct="${estado.vistaCt === 'meses' ? 'lista' : 'meses'}" aria-pressed="${estado.vistaCt === 'meses'}"><span><b>Mês a mês</b> · ativos, novos, LTV${din ? ' e ticket' : ''}</span>${ICQ.seta}</button>
      <button type="button" class="d3m-vlin" data-vc-como aria-expanded="${estado.ajuda}"><span><b>Como funciona</b></span>${ICQ.seta}</button></nav>`;
    const aviso = sv.contratos?.disponivel || f ? '' : avisoM('Os contratos ainda não foram ligados.', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente ficam guardados aqui. Nada se perde até lá.');
    const topo = { sub: `${din ? 'valor, início' : 'início'} e renovação · ${comContrato} com contrato · ${breve + vencidas ? `${plural(breve + vencidas, 'renova', 'renovam')} em 30 dias` : 'nenhuma renovação em 30 dias'}${estado.tipo === 'anual' || estado.mes !== hoje().slice(0, 7) ? ` · ${esc(r.periodo.rotulo)}` : ''}`,
      ferr: buscaM('Buscar contrato por cliente'),
      mais: [`<button type="button" role="menuitem" data-vc-filtros aria-expanded="${estado.filtros}">Período e ordem</button>`, `<button type="button" role="menuitem" data-vc-vista-ct="${estado.vistaCt === 'meses' ? 'lista' : 'meses'}">${estado.vistaCt === 'meses' ? 'Voltar aos clientes' : 'Mês a mês'}</button>`],
      acao: pode && candidatos.length ? `<button type="button" class="d3m-d-vbtn p" data-vc-registrar aria-expanded="${estado.registrar === estado.aba}">${ICQ.mais}Registrar contrato</button>` : '' };
    return { topo, ajuda, corpo: `<div class="d3m-d-ct" data-tela="ct-contratos"><div class="d3m-d-ct-main">${estado.filtros ? periodoM('contratos', ORDENS) : ''}${registrar}${estado.vistaCt === 'meses' ? folhaMeses : folhaLista}${aviso}</div>
      <aside class="d3m-lado d3m-d-ct-lado" aria-label="Consulta">${laranja}${ativosM}${abrirM}</aside></div>` };
  }

  // ---------- janela ----------
  const AJUDA = `<div class="vc-ajuda" role="note"><b>Como a Carteira funciona</b>
    <p><b>Saúde</b>: cada cliente ativo começa com 100 e perde pontos por peça atrasada, risco de furo, voltas para alteração, aprovação parada, entregas fora do prazo, calendário vazio, contrato vencendo, pagamento atrasado, NPS baixo, muito tempo sem reunião e clima ruim no grupo. Abaixo de 50 é risco alto; de 50 a 74, médio. Toque num cliente para ver os motivos.</p>
    <p><b>Onboarding</b>: começa quando entra um cliente novo (o cadastro abre na hora) ou um contrato novo de um cliente da casa. Cada um tem a esteira com checklist e responsável por etapa, a reunião de kickoff (com gravação) e o questionário. "Parada desde" mostra há quanto tempo a etapa atual não anda.</p>
    <p><b>Churn</b>: quem saiu (pela desativação no cadastro), com tipo e motivo. Taxa = saídas ÷ clientes ativos no começo do período. O cohort mostra quantos de cada mês de entrada seguiam ativos depois de 1, 2, 3, 6 e 12 meses.</p>
    <p><b>Contratos</b>: valor mensal, início, renovação e status. Renovações dos próximos 30 dias ficam em destaque. LTV = há quantos meses o cliente está com a Vybe (do início do contrato; sem ele, da entrada no cadastro); receita estimada = valor mensal × meses. O mês a mês mostra ativos, novos, LTV médio e ticket médio.</p>
    <p><b>Contas por head</b> (na Saúde): quantos clientes cada head tem, a nota média deles e a receita mensal.</p>
    <p>Mensal/Anual e o mês no topo valem para Churn e Contratos.</p></div>`;
  // Saúde e Onboarding: a janela inteira é o quadro (cabeçalho numa linha, sem a faixa de período nem a frase).
  function htmlDoQuadro() {
    const lendo = estado.carregando && !estado.servidor && !estado.saude;
    const t = lendo ? { corpo: '<p class="vc-carregando" role="status">Lendo a carteira…</p>' } : ({ saude: abaSaude, onboarding: abaOnboarding, churn: abaChurn, contratos: abaContratos }[estado.aba] || abaSaude)();
    const erro = estado.erro && !estado.carregando ? `<p class="vc-erro" role="alert">${esc(estado.erro)} ${secundario('Tentar de novo', 'data-vc-recarregar')}</p>` : '';
    const abas = abasVisiveis().length > 1 ? `<div class="vc-abas" role="tablist" aria-label="Partes da Carteira">${abasVisiveis().map(([k, r]) => `<button type="button" role="tab" id="vc-aba-${k}" aria-controls="vc-corpo" aria-selected="${estado.aba === k}" tabindex="${estado.aba === k ? 0 : -1}" data-vc-aba="${k}">${r}</button>`).join('')}</div>` : '';
    // Onboarding na prancha V2 (t.v2): o título com a frase do momento e as peças do vidro (zm-b-modulos.css).
    return `<div class="v2c${t.v2 ? ' ob2' : ''}" data-tela="${t.v2 ? `${estado.aba}-v2` : estado.aba}"><div class="v2c-topo">${t.titulo || `<h2 id="vc-titulo">${esc(TITULO_DA_ABA[estado.aba])}</h2>`}${t.topo || ''}${t.v2 ? FECHAR.replace('class="v2c-x"', 'class="ob2-x"') : FECHAR}</div>${abas}
      <p class="vc-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vc-corpo v2c-corpo" id="vc-corpo" role="tabpanel">${erro}${t.corpo}</div></div>`;
  }
  // Contratos e Churn: a janela em vidro fumê, com o topo e a tela direto no vidro.
  function htmlDaJanelaM() {
    const lendo = estado.carregando && !estado.servidor && !estado.saude;
    const t = lendo ? { topo: null, ajuda: '', corpo: '<p class="vc-carregando" role="status">Lendo a carteira…</p>' } : ({ churn: abaChurn, contratos: abaContratos, saude: abaSaudeM }[estado.aba] || abaContratos)();
    const erro = estado.erro && !estado.carregando ? `<p class="vc-erro" role="alert">${esc(estado.erro)} ${btnFolha('Tentar de novo', 'data-vc-recarregar')}</p>` : '';
    return `${topoMq(t.topo)}<p class="vc-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>${estado.ajuda ? t.ajuda || '' : ''}
      <div class="vc-corpo d3m-d-m-corpo" id="vc-corpo" role="tabpanel">${erro}${t.corpo}</div>`;
  }
  function htmlJanela() {
    if (TELAS_M.has(estado.aba)) return htmlDaJanelaM();
    if (TELAS_DO_QUADRO.has(estado.aba)) return htmlDoQuadro();
    const corpo = estado.carregando && !estado.servidor && !estado.saude ? '<p class="vc-carregando" role="status">Lendo a carteira…</p>'
      : ({ churn: abaChurn, contratos: abaContratos }[estado.aba] || abaChurn)();
    const erro = estado.erro && !estado.carregando ? `<p class="vc-erro" role="alert">${esc(estado.erro)} ${secundario('Tentar de novo', 'data-vc-recarregar')}</p>` : '';
    return `<div class="vc-topo">
        <div class="vc-titulo"><span class="vc-kicker">${esc(estado.rotulo || 'Clientes')}</span><h2 id="vc-titulo">${esc(estado.soAbas?.size === 1 ? TITULO_DA_ABA[estado.aba] || 'Carteira' : 'Carteira')}</h2><p class="vc-frase">${esc(estado.soAbas?.size === 1 ? FRASE_DA_ABA[estado.aba] || FRASE_DA_ABA.carteira : FRASE_DA_ABA.carteira)}</p></div>
        <button type="button" class="vc-ico" data-vc-ajuda aria-expanded="${estado.ajuda}" aria-label="O que é a Carteira" title="O que é a Carteira">?</button>
        <button type="button" class="vc-ico" data-vc-fechar aria-label="Fechar" title="Fechar (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </div>
      <div class="vc-controles"${periodoMudaAlgo() ? '' : ' hidden'}>
        <div class="vc-segmento" role="group" aria-label="Período"${estado.aba === 'churn' && !churnTemSaida() ? ' hidden' : ''}>${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, r]) => `<button type="button" data-vc-tipo="${k}" aria-pressed="${estado.tipo === k}">${r}</button>`).join('')}</div>
        ${typeof vbMesHtml === 'function' ? vbMesHtml({ mes: estado.mes, max: hoje().slice(0, 7), attr: 'data-vc-mes-ir', ano: estado.tipo === 'anual' }) : ''}
      </div>
      <div class="vc-abas" role="tablist" aria-label="Partes da Carteira"${abasVisiveis().length > 1 ? '' : ' hidden'}>${abasVisiveis().map(([k, r]) => `<button type="button" role="tab" id="vc-aba-${k}" aria-controls="vc-corpo" aria-selected="${estado.aba === k}" tabindex="${estado.aba === k ? 0 : -1}" data-vc-aba="${k}">${r}</button>`).join('')}</div>
      <p class="vc-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vc-corpo" id="vc-corpo" role="tabpanel" aria-labelledby="vc-aba-${estado.aba}">${estado.ajuda ? AJUDA : ''}${erro}${corpo}</div>`;
  }
  function pintar() {
    const j = estado.janela;
    if (!j) return;
    const corpo = j.querySelector('.vc-corpo'), rolagem = corpo ? corpo.scrollTop : 0;
    const foco = document.activeElement, dentro = foco && j.contains(foco);
    const chave = dentro ? ['data-vc-aba', 'data-vc-risco', 'data-vc-tipo', 'data-vc-abrir', 'data-vc-ordem', 'data-vc-item', 'data-vc-resp', 'data-vc-head', 'data-vc-mes-ir', 'data-vc-falta',
      'data-vc-visao', 'data-vc-filtros', 'data-vc-head-ficha', 'data-vc-etapa-onb', 'data-vc-busca-onb', 'data-vc-ordem-gira', 'data-vc-ajuda', 'data-vc-novo', 'data-vc-encerrados',
      'data-vc-busca', 'data-vc-busca-abre', 'data-vc-como', 'data-vc-vista-ct', 'data-vc-filtro-ct', 'data-vc-filtro-ch', 'data-vc-serie-ct', 'data-vc-vista-ch', 'data-vc-hist-ch', 'data-vc-registrar'].find((a) => foco.hasAttribute(a)) : null;
    const valor = chave ? foco.getAttribute(chave) : null, item = foco?.dataset?.vcCli;
    j.className = TELAS_M.has(estado.aba) ? 'vc-janela d3m-d-m' : 'vc-janela';
    j.innerHTML = htmlJanela();
    j.classList?.[estado.aba === 'onboarding' ? 'add' : 'remove']?.('ob2-janela'); // a janela de vidro da prancha V2 (zm-b-modulos.css)
    if (chave === 'data-vc-busca-onb' || chave === 'data-vc-busca') { const campo = j.querySelector(`[${chave}]`); campo?.focus?.(); campo?.setSelectionRange?.(campo.value.length, campo.value.length); }
    const novoCorpo = j.querySelector('.vc-corpo');
    if (novoCorpo && rolagem) novoCorpo.scrollTop = rolagem; // gravar 0 numa janela nova só forçaria um layout da página inteira
    if (chave) {
      const todos = [...j.querySelectorAll(`[${chave}]`)], rotulo = foco.getAttribute('aria-label');
      // As setas do mês mudam de valor a cada clique: o foco volta para a mesma seta.
      const alvo = todos.find((el) => el.getAttribute(chave) === valor && (!item || el.dataset.vcCli === item)) || todos.find((el) => rotulo && el.getAttribute('aria-label') === rotulo && !el.disabled);
      alvo?.focus?.();
    }
  }
  function avisar(t) { estado.aviso = t; const el = estado.janela?.querySelector('.vc-aviso'); if (el) el.textContent = t; }

  // ---------- eventos ----------
  function editor(fn) { fn(estado.editorEtapas); pintar(); }
  const novoId = (base) => `${String(base || 'x').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 28) || 'x'}_${Math.random().toString(36).slice(2, 7)}`;
  function lerEditor() {
    estado.janela?.querySelectorAll('[data-vc-ed-nome]').forEach((el) => { estado.editorEtapas[Number(el.dataset.vcEdNome)].nome = el.value; });
    estado.janela?.querySelectorAll('[data-vc-ed-item]').forEach((el) => { const [i, j] = el.dataset.vcEdItem.split(':').map(Number); estado.editorEtapas[i].itens[j].texto = el.value; });
  }
  function aoClicar(e) {
    const t = e.target;
    if (t === estado.raiz) { fechar(); return; }
    const b = t?.closest?.('button');
    if (!b || !estado.janela?.contains(b) || b.disabled) return;
    const d = b.dataset;
    if ('vcFechar' in d) return fechar();
    if ('vcAjuda' in d || 'vcComo' in d) { estado.ajuda = !estado.ajuda; return pintar(); }
    if (d.vcIr) return irVista(d.vcIr);
    if ('vcBuscaAbre' in d) { estado.buscaAberta = !(estado.buscaAberta || termoDaBusca()); if (!estado.buscaAberta) estado.busca[estado.aba] = ''; pintar(); if (estado.buscaAberta) estado.janela?.querySelector?.('[data-vc-busca]')?.focus?.(); return; }
    if (d.vcVistaCt) { estado.vistaCt = d.vcVistaCt === 'meses' ? 'meses' : 'lista'; return pintar(); }
    if (d.vcAba) { estado.aba = d.vcAba; estado.form = null; estado.aviso = ''; return pintar(); }
    if (d.vcTipo) { estado.tipo = d.vcTipo; return pintar(); }
    if (d.vcMesIr) { if (/^\d{4}-\d{2}$/.test(d.vcMesIr)) estado.mes = d.vcMesIr; return pintar(); }
    if ('vcFalta' in d) { estado.verFalta = !estado.verFalta; return pintar(); }
    if (d.vcRisco) { estado.risco = d.vcRisco; if ('vcLimpar' in d) estado.head = 'todos'; delete estado.limite.saude; return pintar(); }
    if (d.vcMais) { estado.limite[d.vcMais] = (estado.limite[d.vcMais] || PAGINA) + PAGINA; return pintar(); }
    // A linha pedida pelo cartão laranja abre mesmo fora da ficha escolhida ou com o "Mês a mês" na frente.
    if (d.vcAbrir && d.vcFocar && TELAS_M.has(estado.aba)) { estado.vistaCt = 'lista'; estado.filtroCt = 'todos'; estado.busca[estado.aba] = ''; estado.abertos.add(d.vcAbrir); pintar(); }
    if (d.vcAbrir) return alternarLinha(d.vcAbrir, d.vcFocar || '');
    if (d.vcVisao) { estado.visao = d.vcVisao; return pintar(); }
    if ('vcFiltros' in d) { estado.filtros = !estado.filtros; return pintar(); }
    if (d.vcHeadFicha) { estado.head = estado.head === d.vcHeadFicha ? 'todos' : d.vcHeadFicha; delete estado.limite.saude; return pintar(); }
    if (d.vcOrdemSaude) { estado.ordem.saude = d.vcOrdemSaude; b.closest?.('details')?.removeAttribute?.('open'); return pintar(); }
    if ('vcOrdemGira' in d) { const o = ['risco', 'melhor', 'nome']; estado.ordem.saude = o[(o.indexOf(estado.ordem.saude) + 1) % o.length]; return pintar(); }
    if (d.vcEtapaOnb) { estado.etapaOnb = d.vcEtapaOnb; if ('vcLimpar' in d) estado.buscaOnb = ''; return pintar(); }
    if ('vcNovo' in d) { estado.novoOnb = !estado.novoOnb; if (!estado.novoOnb) estado.contratoNovo = false; pintar(); if (estado.novoOnb) estado.janela.querySelector?.('.vc-onb-caminho')?.focus?.(); return; }
    if ('vcAtrasadas' in d) {
      // As peças vencidas de todos os clientes: Demandas, já no filtro de atrasadas.
      fechar({ foco: false });
      if (typeof chooseManagerMode === 'function') chooseManagerMode('demandas');
      setTimeout(() => { try { if (typeof focarAtrasadas === 'function' && typeof currentDemandaAtrasadas !== 'undefined' && !currentDemandaAtrasadas) focarAtrasadas(); } catch { /* Demandas abre sem o filtro */ } }, 160);
      return;
    }
    if ('vcMeta' in d) { estado.metaEditar = !estado.metaEditar; pintar(); estado.janela?.querySelector?.('[data-vc-meta-campo]')?.focus?.(); return; }
    if ('vcMetaSalvar' in d) { // a meta da nota (só donos: a rota confere)
      const campo = estado.janela?.querySelector?.('[data-vc-meta-campo]'), v = String(campo?.value || '').trim();
      b.disabled = true;
      fetch('/api/painel?area=metas', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ carteira_nota: v === '' ? null : Number(v) }) })
        .then(async (r) => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Não foi possível gravar a meta.'); metas = j; estado.metaEditar = false; pintar(); })
        .catch((e) => { b.disabled = false; if (typeof showToast === 'function') showToast(e.message); });
      return;
    }
    if ('vcRecarregar' in d) return carregar();
    if ('vcAtualizar' in d) return location.reload();
    if (d.vcCliente) {
      const nome = d.vcCliente;
      fechar({ foco: false });
      if (typeof chooseClientMode === 'function') chooseClientMode();
      setTimeout(() => { if (typeof abrirClienteDetalhe === 'function') abrirClienteDetalhe(nome); }, 120);
      return;
    }
    if ('vcIniciar' in d) {
      const id = estado.janela.querySelector('[data-vc-novo-onb]')?.value;
      if (id) { estado.contratoNovo = false; gravar({ acao: 'onboarding_iniciar', cliente_id: id, novo_contrato: true }, 'Esteira do contrato novo começada. Marque o kickoff.'); }
      return;
    }
    if ('vcContratoNovo' in d) { estado.contratoNovo = !estado.contratoNovo; pintar(); if (estado.contratoNovo) estado.janela.querySelector('[data-vc-novo-onb]')?.focus(); return; }
    if ('vcOnbNovo' in d) {
      // O cadastro completo (vybe-clientes-ficha.js) abre por cima; ao salvar, a esteira do cliente novo já começa.
      window.abrirCadastroCompleto('', { depois: async (r) => {
        const id = String(r?.cliente?.id || '');
        if (!id || !estado.raiz) return;
        await gravar({ acao: 'onboarding_iniciar', cliente_id: id }, 'Cliente cadastrado e esteira começada. Marque o kickoff.');
      } });
      return;
    }
    if ('vcReunioes' in d) { fechar({ foco: false }); return window.VybeReunioes?.abrir?.(); }
    if (d.vcKickoff) return window.abrirReuniao?.(d.vcKickoff, '', { tipo: 'onboarding', titulo: `Kickoff - ${d.vcKickoff}` });
    if (d.vcQuest) return d.vcQuest === 'junto' ? window.abrirQuestionario?.(d.vcCli, d.vcNome || '') : window.onboardingLink?.(d.vcCli);
    if (d.vcOnb) return gravar({ acao: d.vcOnb, cliente_id: d.vcCli }, d.vcOnb === 'onboarding_encerrar' ? 'Onboarding encerrado.' : 'Onboarding reaberto.');
    if ('vcEncerrados' in d) { estado.verEncerrados = !estado.verEncerrados; return pintar(); }
    if (d.vcFormAbrir) {
      // O formulário mostra o valor: só abre para quem pode gravar (o servidor confere de novo).
      if (!(d.vcFormAbrir === 'churn' ? podeChurn() : podeContratos())) return;
      // onde: em que lugar da tela o formulário abre (Pede ação, a linha da lista ou o painel de registrar); campo: o que ganha o foco.
      estado.form = { tipo: d.vcFormAbrir, id: d.vcCli, onde: d.vcOnde || '', motivo: '' };
      pintar();
      const form = [...estado.janela.querySelectorAll('.vc-form')].find((x) => x.dataset?.vcCli === d.vcCli) || estado.janela.querySelector('.vc-form');
      ((d.vcCampo && form?.querySelector(`[name="${d.vcCampo}"]`)) || form?.querySelector('input, select'))?.focus?.();
      return;
    }
    if ('vcFormCancelar' in d) { estado.form = null; return pintar(); }
    // Contratos e Churn (quadros do padrão v2): fichas, série do mês a mês, vista de saídas, histórico e registrar.
    if (d.vcFiltroCt) { estado.filtroCt = d.vcFiltroCt; if ('vcLimpar' in d) estado.busca.contratos = ''; delete estado.limite.contratos; return pintar(); }
    if (d.vcFiltroCh) { estado.filtroCh = d.vcFiltroCh; if ('vcLimpar' in d) estado.busca.churn = ''; delete estado.limite.churn; return pintar(); }
    if (d.vcSerieCt) { estado.serieCt = d.vcSerieCt; return pintar(); }
    if (d.vcVistaCh) { estado.vistaCh = d.vcVistaCh; return pintar(); }
    if ('vcHistCh' in d) { estado.histCh = !estado.histCh; delete estado.limite.churn; return pintar(); }
    if ('vcRegistrar' in d) { estado.registrar = estado.registrar === estado.aba ? false : estado.aba; if (estado.form?.onde === 'registrar') estado.form = null; pintar(); if (estado.registrar) estado.janela.querySelector?.('[data-vc-registrar-cli]')?.focus?.(); return; }
    if (d.vcRegistrarIr) {
      const id = estado.janela.querySelector('[data-vc-registrar-cli]')?.value;
      if (id) { estado.form = { tipo: d.vcRegistrarIr, id, onde: 'registrar', motivo: '' }; pintar(); estado.janela.querySelector('.v2k-registrar .vc-form input, .v2k-registrar .vc-form select')?.focus?.(); }
      return;
    }
    if (d.vcMotivoCh) {
      // "Por quê?": a ficha escolhe o motivo no formulário aberto (o mesmo que grava), sem redesenhar o que já foi digitado.
      if (estado.form) estado.form.motivo = d.vcMotivoCh;
      const caixa = b.closest?.('.v2k-acao-form, .v2k-registrar'), sel = caixa?.querySelector?.('select[name="motivo"]');
      if (sel) sel.value = d.vcMotivoCh;
      caixa?.querySelectorAll?.('[data-vc-motivo-ch]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.vcMotivoCh === d.vcMotivoCh)));
      return;
    }
    // Editor das etapas.
    if ('vcEdAbrir' in d) { estado.editorEtapas = JSON.parse(JSON.stringify(estado.servidor.etapas || [])); return pintar(); }
    if ('vcEdCancelar' in d) { estado.editorEtapas = null; return pintar(); }
    if (estado.editorEtapas) {
      lerEditor();
      if ('vcEdPadrao' in d) { estado.editorEtapas = JSON.parse(JSON.stringify(estado.servidor.etapas_padrao || [])); return pintar(); }
      if ('vcEdNova' in d) return editor((l) => l.push({ id: novoId('etapa'), nome: 'Nova etapa', itens: [] }));
      if (d.vcEdMover) return editor((l) => { const [i, dir] = d.vcEdMover.split(':').map(Number); const [x] = l.splice(i, 1); l.splice(i + dir, 0, x); });
      if (d.vcEdTirar) return editor((l) => l.splice(Number(d.vcEdTirar), 1));
      if (d.vcEdItemNovo) return editor((l) => l[Number(d.vcEdItemNovo)].itens.push({ id: novoId('item'), texto: 'Novo item' }));
      if (d.vcEdItemMover) return editor((l) => { const [i, j, dir] = d.vcEdItemMover.split(':').map(Number); const it = l[i].itens; const [x] = it.splice(j, 1); it.splice(j + dir, 0, x); });
      if (d.vcEdItemTirar) return editor((l) => { const [i, j] = d.vcEdItemTirar.split(':').map(Number); l[i].itens.splice(j, 1); });
      if ('vcEdSalvar' in d) {
        const etapas = estado.editorEtapas.map((x) => ({ ...x, nome: x.nome.trim(), itens: x.itens.filter((i) => i.texto.trim()).map((i) => ({ ...i, texto: i.texto.trim() })) }));
        estado.editorEtapas = null;
        return gravar({ acao: 'etapas_salvar', etapas }, 'Etapas salvas.');
      }
    }
  }
  // A linha abre no lugar (quadro): troca o estado na própria linha, sem redesenhar a tela, para o movimento aparecer.
  function alternarLinha(chave, focar = '') {
    const abrindo = focar ? true : !estado.abertos.has(chave);
    if (abrindo) estado.abertos.add(chave); else estado.abertos.delete(chave);
    const linha = [...(estado.janela?.querySelectorAll?.('[data-vc-linha]') || [])].find((x) => x.dataset.vcLinha === chave);
    if (!linha) return pintar();
    linha.setAttribute('aria-expanded', String(abrindo));
    linha.querySelector('.v2c-abrir, .ob2-abrir, [data-vc-abrir]')?.setAttribute('aria-expanded', String(abrindo));
    if (focar) { linha.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); (focar === 'resp' ? [...linha.querySelectorAll('select[data-vc-resp]')].find((x) => !x.value && !x.disabled) : linha.querySelector('.v2c-abrir, .ob2-abrir, [data-vc-abrir]'))?.focus?.({ preventScroll: true }); }
  }
  function aoDigitar(e) {
    if (e.target?.matches?.('[data-vc-busca]')) { estado.busca[estado.aba] = e.target.value.slice(0, 60); delete estado.limite[estado.aba]; pintar(); return; }
    if (!e.target?.matches?.('[data-vc-busca-onb]')) return;
    estado.buscaOnb = e.target.value.slice(0, 60);
    pintar();
  }
  function aoMudar(e) {
    const t = e.target, d = t.dataset || {};
    if (d.vcOrdem) { estado.ordem[d.vcOrdem] = t.value; estado.limite[d.vcOrdem] = PAGINA; return pintar(); }
    if ('vcHead' in d) { estado.head = t.value; estado.limite.saude = PAGINA; return pintar(); }
    if (d.vcItem) return gravar({ acao: 'onboarding_marcar', cliente_id: d.vcCli, etapa: d.vcEtapa, item: d.vcItem, feito: t.checked }, t.checked ? 'Marcado.' : 'Desmarcado.');
    if (d.vcResp) return gravar({ acao: 'onboarding_responsavel', cliente_id: d.vcResp, etapa: d.vcEtapa, pessoa_id: t.value || null }, 'Responsável salvo.');
  }
  function aoEnviar(e) {
    const f = e.target.closest?.('[data-vc-form]');
    if (!f) return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(f).entries());
    if (f.dataset.vcForm === 'churn') gravar({ acao: 'churn_registrar', cliente_id: f.dataset.vcCli, ...v }, 'Motivo da saída salvo.');
    else gravar({ acao: 'contrato_salvar', cliente_id: f.dataset.vcCli, ...v }, 'Contrato salvo.');
  }
  const visivel = (el) => Boolean(el.getClientRects?.().length);
  function aoTeclar(e) {
    if (!estado.raiz) return;
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if ([...document.querySelectorAll(ACIMA)].some((el) => !estado.raiz.contains(el) && visivel(el))) return;
      e.preventDefault();
      e.stopPropagation();
      if (estado.form) { estado.form = null; pintar(); return; }
      if (estado.editorEtapas) { estado.editorEtapas = null; pintar(); return; }
      if (estado.ajuda) { estado.ajuda = false; pintar(); return; }
      fechar();
      return;
    }
    // Setas trocam de aba (padrão de tablist).
    const aba = e.target?.closest?.('[role="tab"][data-vc-aba]');
    if (aba && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const V = abasVisiveis(), i = V.findIndex(([k]) => k === aba.dataset.vcAba), n = V[(i + (e.key === 'ArrowRight' ? 1 : V.length - 1)) % V.length][0];
      e.preventDefault();
      estado.aba = n;
      pintar();
      estado.janela.querySelector(`[data-vc-aba="${n}"]`)?.focus();
    }
  }

  // ---------- API ----------
  // Aberto pelo dock, a janela mostra só as abas daquele item (opções { abas, rotulo }); com uma aba só, sem barra de abas.
  const abasVisiveis = () => ABAS.filter(([k]) => !estado.soAbas || estado.soAbas.has(k));
  function abrir(aba = 'saude', opcoes = {}) {
    estado.soAbas = Array.isArray(opcoes.abas) && opcoes.abas.length ? new Set(opcoes.abas) : null;
    estado.aba = ABAS.some(([k]) => k === aba) ? aba : 'saude';
    estado.rotulo = opcoes.rotulo || '';
    if (!estado.mes) estado.mes = hoje().slice(0, 7);
    estado.aviso = '';
    if (!estado.raiz) {
      estado.antes = document.activeElement || null;
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vc-camada';
      janela.id = 'vv-carteira';
      janela.className = 'vc-janela';
      janela.setAttribute('role', 'dialog');
      janela.setAttribute('aria-modal', 'true');
      janela.setAttribute('aria-labelledby', 'vc-titulo');
      raiz.append(janela);
      raiz.addEventListener('click', aoClicar);
      raiz.addEventListener('change', aoMudar);
      raiz.addEventListener('input', aoDigitar);
      raiz.addEventListener('submit', aoEnviar);
      document.body.append(raiz);
      Object.assign(estado, { raiz, janela });
      window.VybeTutorial?.dica?.('modulo:carteira');
    }
    const leitura = carregar();
    estado.janela.querySelector('[role="tab"][aria-selected="true"]')?.focus();
    return leitura;
  }
  function fechar(opcoes = {}) {
    const { raiz, antes } = estado;
    if (!raiz) return;
    Object.assign(estado, { raiz: null, janela: null, antes: null, form: null, editorEtapas: null, ajuda: false });
    raiz.remove();
    if (opcoes.foco !== false && antes?.isConnected) antes.focus?.();
  }
  const aberto = () => Boolean(estado.raiz);
  function dados() {
    const r = estado.saude || calcularSaude();
    return r ? r.clientes.map((c) => ({ cliente: c.nome, clienteId: c.id, score: c.score, risco: c.risco, precisa: precisaDeVoce(c), vencidas: c.numeros?.atrasadas || 0,
      motivos: c.motivos.filter((m) => m.tom === 'ruim').map((m) => m.texto), head: c.heads.join(', ') })) : [];
  }
  // O resumo da carteira para a lista de Clientes (prancha V2-M-Clientes): a média, o limite de quem precisa de você e o
  // sinal que mais tira ponto, com a nota a que a carteira iria sem ele (a mesma conta da fala da Saúde).
  function resumo() {
    const r = estado.saude || calcularSaude();
    if (!r || !r.clientes.length) return null;
    const soma = new Map();
    for (const c of r.clientes) for (const m of ruinsDe(c)) { const k = causaDe(m), x = soma.get(k) || { pontos: 0, clientes: new Set(), maior: 0 }; x.pontos -= m.pontos; x.maior = Math.max(x.maior, -m.pontos); x.clientes.add(c); soma.set(k, x); }
    const [causa, x] = [...soma.entries()].sort((a, b) => b[1].pontos - a[1].pontos)[0] || [];
    const semEla = causa ? Math.round(r.clientes.reduce((t, c) => t + Math.min(100, c.score + ruinsDe(c).filter((m) => causaDe(m) === causa).reduce((s, m) => s - m.pontos, 0)), 0) / r.clientes.length) : null;
    const porCliente = causa ? [...x.clientes].map((c) => ruinsDe(c).filter((m) => causaDe(m) === causa).reduce((s, m) => s - m.pontos, 0)) : [];
    return { media: r.resumo.media ?? null, total: r.clientes.length, limite: LIMITE_PRECISA, precisam: r.clientes.filter(precisaDeVoce).length,
      vencidas: r.clientes.reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0),
      causa: causa || '', deAtraso: causa === 'atraso de veiculação' || causa === 'prazo interno vencido', clientesDaCausa: causa ? x.clientes.size : 0, semEla,
      tira: porCliente.length ? Math.max(...porCliente) : 0, tiraIgual: porCliente.length > 0 && porCliente.every((p) => p === porCliente[0]) };
  }

  window.addEventListener('keydown', aoTeclar, true);
  window.VybeCarteira = Object.freeze({ abrir, fechar, aberto, dados, resumo });
})();
