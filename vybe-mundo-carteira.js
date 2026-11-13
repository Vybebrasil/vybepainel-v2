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
    busca: {}, filtroCt: 'todos', filtroCh: 'todas', serieCt: 'ativos', vistaCh: 'motivos', registrar: false, histCh: false,
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
  // Contratos: os do Vybe OS com os do Vybe Finanças por cima, quando ligado (vybe-mundo-financas.js).
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
    // Contratos do Vybe Finanças (só leitura): chegam depois e repintam; sem o Finanças, nada muda.
    window.VybeFinancas?.carregar?.('carteira').then(() => { if (estado.raiz && finCarteira()) { estado.saude = calcularSaude(); pintar(); } });
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
    } catch (e) { estado.aviso = e.aguardando ? 'Esta parte ainda não foi ligada. Os donos já sabem o que falta.' : e.message; }
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

  // ---------- Saúde ----------
  function serieHtml(h) {
    if (!estado.servidor?.historico?.disponivel) return nota('A média mês a mês começa a ser guardada quando a Carteira for ativada no banco.');
    if (h.serie.length < 2) return nota('A média mês a mês aparece a partir do segundo mês guardado.');
    return `<div class="vc-serie" role="img" aria-label="${esc(`Média da carteira: ${h.serie.map((m) => `${m.mes.slice(5, 7)}/${m.mes.slice(2, 4)} ${m.media}`).join(', ')}`)}">${h.serie.map((m) =>
      `<div class="vc-barra${m.agora ? ' agora' : ''}"><b>${m.media}</b><i class="${NIVEL_RISCO[S().riscoDaNota(m.media)]}" style="height:${Math.max(6, m.media)}%"></i><small>${m.mes.slice(5, 7)}/${m.mes.slice(2, 4)}</small></div>`).join('')}</div>`;
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

  // A linha do cliente: a nota, quem é, a barra do que tirou ponto de 100 e a ação. Abre no lugar com cada perda.
  function linhaCliente(c, casa = null) {
    const chave = `c:${c.nome}`, aberto = estado.abertos.has(chave), tempo = c.id && casa ? casa.get(c.id) : null;
    const ruins = ruinsDe(c), bons = c.motivos.filter((m) => m.tom !== 'ruim'), perdeu = ruins.reduce((t, m) => t - m.pontos, 0);
    const vencidas = c.numeros?.atrasadas || 0;
    const legenda = ruins.length ? ruins.slice(0, 3).map((m) => `<span style="--c:${corDaPerda(m)}">${esc(motivoCurto(m.texto))}</span>`).join('')
      : `<span style="--c:#11613A">${esc(bons[0]?.texto || 'sem sinal de alerta')}</span>`;
    // 10 · Cor do humor: a nota de saúde (0 a 100) pinta a linha do vermelho ao verde.
    return `<li class="v2-abre v2c-linha${Number.isFinite(Number(c.score)) ? " v2-humor" : ""}" data-vc-linha="${esc(chave)}"${Number.isFinite(Number(c.score)) ? (typeof vbHumorAttr === 'function' ? vbHumorAttr(c.score) : '') : ''} aria-expanded="${aberto}"><div class="v2c-lin">
        <button type="button" class="v2c-abrir" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${c.nome}, nota ${c.score}, ${c.rotuloRisco}`)}">
          <span class="v2c-nota ${TOM_DO_RISCO[c.risco] || 'a'}">${c.score}</span>
          <span class="v2c-quemc"><b>${cliCor(c.nome)}</b><small>${esc(c.heads.length ? `Head ${c.heads.map(primeiroNome).join(' e ')}` : 'Sem head')} · ${esc(String(c.rotuloRisco || '').toLowerCase())}</small></span>
          <span class="v2c-porque"><span class="v2c-perde" role="img" aria-label="${esc(perdeu ? `Perdeu ${perdeu} de 100 pontos` : 'Não perdeu ponto')}">${ruins.map((m) => `<i style="--v:${-m.pontos}%;--c:${corDaPerda(m)}"></i>`).join('')}</span><span class="v2c-leg">${legenda}</span></span>
          ${SETA}</button>
        <span class="v2c-ac">${botao(vencidas > 1 ? `Abrir as ${vencidas}` : vencidas === 1 ? 'Abrir a peça' : 'Abrir o cliente', `data-vc-cliente="${esc(c.nome)}"`)}</span></div>
      <div class="v2-mais"><div><div class="v2c-det">
        ${ruins.map((m) => `<p class="v2c-mot" style="--c:${corDaPerda(m)}"><b>−${-m.pontos}</b>${esc(m.texto)}</p>`).join('')}
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
    if (!causa) return falaHtml(`A carteira está em <b>${r.resumo.media}</b> e nenhum cliente perdeu ponto.`);
    const n = x.clientes.size, deAtraso = causa === 'atraso de veiculação' || causa === 'prazo interno vencido', vencidas = deAtraso ? [...x.clientes].reduce((t, c) => t + (c.numeros?.atrasadas || 0), 0) : 0;
    const semEla = Math.round(r.clientes.reduce((t, c) => t + Math.min(100, c.score + ruinsDe(c).filter((m) => causaDe(m) === causa).reduce((s, m) => s - m.pontos, 0)), 0) / r.clientes.length);
    const quem = deAtraso && vencidas ? `${plural(n, 'cliente soma', 'clientes somam')} ${plural(vencidas, 'peça vencida', 'peças vencidas')}` : `pesa em ${plural(n, 'cliente', 'clientes')}`;
    return falaHtml(`A carteira está em <b>${r.resumo.media}</b>. Quem puxa para baixo é <b>${esc(causa)}</b>: ${quem}. Resolver ${n === 1 ? 'esse' : `esses ${n}`} leva a média a ${semEla}.`,
      deAtraso && vencidas ? botao(vencidas === 1 ? 'Ver a peça' : `Ver as ${vencidas} peças`, 'data-vc-atrasadas') : botao(n === 1 ? 'Ver o cliente' : `Ver os ${n} clientes`, 'data-vc-risco="todos" data-vc-limpar'));
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
    const topo = `<span class="v2c-seg" role="group" aria-label="Visão">${[['agora', 'Agora'], ['meses', 'Mês a mês']].map(([k, rot]) => `<button type="button" data-vc-visao="${k}" aria-pressed="${estado.visao === k}">${rot}</button>`).join('')}</span>
      ${botao('Como a nota é feita', `data-vc-ajuda aria-expanded="${estado.ajuda}"`, 'g')}`;
    const ajuda = estado.ajuda ? `<div class="v2c-card v2c-ajuda">${AJUDA}${nota(fonte)}</div>` : '';
    // "Mês a mês": o que saiu do alto da tela (a média guardada de cada mês e as contas por head).
    if (estado.visao === 'meses') {
      return { topo, corpo: `${ajuda}<section class="v2c-card"><div class="v2c-card-topo"><h2>Média da carteira mês a mês</h2><small>a nota média guardada em cada mês</small></div>${serieHtml(h)}</section>
        ${contas.length ? `<div class="v2c-card v2c-contas">${contasHtml(contas)}</div>` : ''}` };
    }
    const precisam = r.clientes.filter(precisaDeVoce), tranquilos = r.clientes.filter((c) => !precisaDeVoce(c));
    const v = h.variacao.media, mudou = v && v.direcao !== 'igual' && v.anterior != null ? `<span class="v2c-pill ${v.direcao === 'sobe' ? 'g' : 'a'}">${v.direcao === 'sobe' ? 'subiu' : 'caiu'} ${Math.abs(v.delta)} no mês</span>` : '';
    const riscoDaMedia = S().riscoDaNota(r.resumo.media ?? 0);
    const numeros = `<div class="v2c-tres">
        ${kpiHtml({ rotulo: 'Nota média', valor: r.resumo.media ?? '—', extra: mudou ? ` ${mudou}` : '',
          sub: `<div class="v2-barra"><i style="--v:${r.resumo.media ?? 0}%;--c:${COR_DO_RISCO[riscoDaMedia] || '#E0A21B'}"></i></div><small>de 0 a 100 · ${plural(r.clientes.length, 'cliente ativo', 'clientes ativos')}</small>` })}
        ${kpiHtml({ rotulo: 'Precisam de você', valor: precisam.length, atraso: 0.12, sub: `<small>risco alto ou nota abaixo de ${LIMITE_PRECISA}</small>` })}
        ${kpiHtml({ rotulo: 'Tranquilos', valor: tranquilos.length, atraso: 0.24,
          sub: `<p class="v2c-minis">${[...tranquilos].sort((a, b) => b.score - a.score).slice(0, 3).map((c) => `<span class="v2c-nota mini ${TOM_DO_RISCO[c.risco] || 'a'}" title="${esc(c.nome)}">${c.score}</span>`).join('')}<span>${tranquilos.length ? 'ficam recolhidos' : 'ninguém por enquanto'}${estado.risco === 'precisam' && tranquilos.length ? ` · ${ligacao('mostrar', 'data-vc-risco="todos"')}` : ''}</span></p>` })}
      </div>`;
    const conta = (k) => (k === 'precisam' ? precisam.length : k === 'todos' ? r.clientes.length : r.resumo[k]);
    const noAlto = heads.filter((x) => x !== S().SEM_HEAD).slice(0, 3);
    const filtros = `<div class="v2c-filtros">
        <span class="v2c-chips" role="group" aria-label="Filtrar por risco">${[['precisam', 'Precisam de você'], ['todos', 'Todos'], ['alto', 'Risco alto'], ['medio', 'Risco médio'], ['baixo', 'Risco baixo']].map(([k, rot]) => ficha(rot, conta(k), `data-vc-risco="${k}"`, estado.risco === k)).join('')}</span>
        <span class="v2c-espaco"></span>
        <span class="v2c-chips" role="group" aria-label="Filtrar por head">${noAlto.map((x) => ficha(`${avatarHtml(x)}${esc(primeiroNome(x))}`, null, `data-vc-head-ficha="${esc(x)}" title="${esc(`Só os clientes de ${x}`)}"`, estado.head === x)).join('')}</span>
        ${botao('Filtros', `data-vc-filtros aria-expanded="${estado.filtros}"`)}
      </div>${estado.filtros ? `<div class="v2c-card v2c-painel"><label class="vc-ordem"><span>Head</span><select data-vc-head><option value="todos">Todos</option>${heads.map((x) => `<option${estado.head === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        ${ordemHtml('saude', [['risco', 'Pior nota primeiro'], ['melhor', 'Melhor nota primeiro'], ['nome', 'Nome A–Z']])}</div>` : ''}`;
    const limite = estado.limite.saude || PAGINA_QUADRO, resto = lista.length - limite;
    const semNinguem = estado.risco === 'precisam' && estado.head === 'todos' ? 'Ninguém precisa de você agora.' : 'Nenhum cliente neste filtro.';
    const corpoLista = lista.length ? `<ol class="v2c-lista">${lista.slice(0, limite).map((c) => linhaCliente(c, casa)).join('')}</ol>`
      : `<div class="v2c-vazio"><p>${semNinguem}</p>${botao('Ver todos', 'data-vc-risco="todos" data-vc-limpar')}</div>`;
    const pe = `<p class="v2c-pe">${resto > 0 ? `+ ${plural(resto, 'cliente', 'clientes')}${estado.risco === 'precisam' ? ` que ${resto === 1 ? 'precisa' : 'precisam'} de você` : ''} · ${ligacao('mostrar', 'data-vc-mais="saude"')} · ` : ''}a barra mostra o que tirou ponto de 100; o verde que sobra é a nota.</p>`;
    return { topo, corpo: `${ajuda}${falaDaSaude(r)}${numeros}${filtros}
      <section class="v2c-card v2c-quadro" aria-label="${esc(TITULO_DO_FILTRO[estado.risco] || TITULO_DO_FILTRO.todos)}"><div class="v2c-card-topo"><h2>${esc(TITULO_DO_FILTRO[estado.risco] || TITULO_DO_FILTRO.todos)}</h2><small>${ROTULO_DA_ORDEM[estado.ordem.saude] || ROTULO_DA_ORDEM.risco} · ${ligacao('mudar a ordem', 'data-vc-ordem-gira')}</small></div>
        ${corpoLista}${pe}</section>` };
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
  const podeOnboarding = (clienteId) => Boolean(estado.servidor?.pode?.onboarding_todos || estado.servidor?.meus_clientes?.includes(String(clienteId)));
  function nomeDaPessoa(id) { return (estado.servidor?.pessoas || []).find((p) => String(p.id) === String(id))?.nome || ''; }
  // A situação da linha, pelo que o servidor devolve: pronta para encerrar, parada, sem responsável ou andando.
  function situacaoDaLinha(o) {
    const s = o.situacao, d = s.atual?.dias_parada ?? 0;
    if (o.encerrado_em) return { tipo: 'encerrado', tom: 'n', texto: `Encerrado em ${dataCurta(diaDoCarimbo(o.encerrado_em))}` };
    if (s.concluido) return { tipo: 'pronto', tom: 'g', texto: 'Pronto para encerrar', pede: true };
    if (d > DIAS_PARADO) return { tipo: 'parado', tom: 'r', texto: `Parado há ${plural(d, 'dia', 'dias')}`, pede: true };
    if (!s.atual?.responsavel_id) return { tipo: 'sem-dono', tom: 'a', texto: 'Sem responsável', pede: true };
    return { tipo: 'andando', tom: 'g', texto: d ? `Andando · ${plural(d, 'dia', 'dias')}` : 'Andando' };
  }
  // A linha do quadro: situação, cliente, as etapas em bolinhas, a etapa de agora, o checklist dela e a ação.
  // Aberta no lugar, mostra cada etapa com o responsável e o checklist, e os atalhos (kickoff, questionário, ficha).
  function linhaOnboarding(o, etapas) {
    const s = o.situacao, sit = situacaoDaLinha(o), chave = `o:${o.cliente_id}`, aberto = estado.abertos.has(chave), pode = podeOnboarding(o.cliente_id) && !o.encerrado_em;
    const pessoas = estado.servidor?.pessoas || [], resp = s.atual?.responsavel_id ? nomeDaPessoa(s.atual.responsavel_id) : '';
    const n = s.etapas.findIndex((e) => e.id === s.atual?.id) + 1;
    const tri = `<span class="v2c-tri" role="img" aria-label="${esc(s.concluido ? 'Todas as etapas feitas' : `Etapa ${n || 1} de ${s.etapas.length}`)}">${s.etapas.map((e) => `<i class="v2c-cx${e.concluida ? ' ok' : s.atual?.id === e.id ? ' at' : ''}">${e.concluida ? CHECK : ''}</i>`).join('')}</span>`;
    const def = etapas.find((e) => e.id === s.atual?.id), feitos = o.etapas?.[def?.id]?.feitos || {}, faltam = (def?.itens || []).filter((i) => !feitos[i.id]);
    const parada = s.atual?.parada_desde && sit.tipo === 'parado' ? `, parada desde ${dataCurta(diaDoCarimbo(s.atual.parada_desde)).slice(0, 5)}` : '';
    const agora = o.encerrado_em ? '<b>Encerrado</b>' : s.concluido ? '<b>Todas as etapas feitas</b>'
      : `<b>${esc(s.atual?.nome || '')}</b>${faltam.length ? ` · falta ${esc(faltam[0].texto.replace(/^./, (c) => c.toLowerCase()))}${faltam.length > 1 ? ` e mais ${faltam.length - 1}` : ''}` : ''}${parada}`;
    const atual = s.etapas.find((e) => e.id === s.atual?.id), pct = atual?.total ? Math.round((atual.feitos / atual.total) * 100) : s.pct;
    const progresso = `<span class="v2c-pg"><span class="v2-barra"><i style="--v:${pct}%;--c:#11613A"></i></span><small>${atual ? `${atual.feitos} de ${atual.total}` : `${s.pct}%`} · ${esc(primeiroNome(resp) || 'sem dono')}</small></span>`;
    const acaoDaLinha = !podeOnboarding(o.cliente_id) ? botao('Ver etapas', `data-vc-abrir="${esc(chave)}"`)
      : o.encerrado_em ? botao('Reabrir', `data-vc-onb="onboarding_reabrir" data-vc-cli="${esc(o.cliente_id)}"`)
      : sit.tipo === 'pronto' ? botao('Encerrar onboarding', `data-vc-onb="onboarding_encerrar" data-vc-cli="${esc(o.cliente_id)}"`)
      : sit.tipo === 'sem-dono' ? botao('Definir responsável', `data-vc-abrir="${esc(chave)}" data-vc-focar="resp"`)
      : botao('Abrir checklist', `data-vc-abrir="${esc(chave)}"`);
    const detalhe = etapas.map((e, i) => {
      const dela = o.etapas?.[e.id] || {}, st = s.etapas.find((x) => x.id === e.id);
      return `<fieldset class="vc-etapa v2c-etapa"><legend><i class="v2c-cx${st?.concluida ? ' ok' : s.atual?.id === e.id ? ' at' : ''}" aria-hidden="true">${st?.concluida ? CHECK : ''}</i><span class="${st?.concluida ? 'feita' : ''}">${i + 1} · ${esc(e.nome)}</span> <small>${st ? `${st.feitos}/${st.total}` : ''}</small></legend>
        <label class="vc-campo"><span>Responsável</span><select data-vc-resp="${esc(o.cliente_id)}" data-vc-etapa="${esc(e.id)}"${pode ? '' : ' disabled'}>
          <option value="">Sem responsável</option>${pessoas.map((p) => `<option value="${esc(p.id)}"${String(dela.responsavel_id) === String(p.id) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <ul class="vc-check">${e.itens.map((it) => { const f = dela.feitos?.[it.id];
          return `<li><label><input type="checkbox" data-vc-item="${esc(it.id)}" data-vc-etapa="${esc(e.id)}" data-vc-cli="${esc(o.cliente_id)}"${f ? ' checked' : ''}${pode ? '' : ' disabled'}>
            <span>${esc(it.texto)}${f ? `<small>${esc(f.por || '')} · ${dataCurta(diaDoCarimbo(f.em))}</small>` : ''}</span></label></li>`; }).join('') || '<li class="vc-nota">Etapa sem itens.</li>'}</ul></fieldset>`;
    }).join('');
    // Reunião e questionário (vybe-clientes-reunioes.js): o kickoff grava o áudio; o questionário serve para preencher junto
    // na reunião ou para mandar o link ao cliente.
    const atalhos = `<div class="v2c-atalhos">${pode && typeof window.abrirReuniao === 'function' ? `${botao('Reunião de kickoff', `data-vc-kickoff="${esc(o.cliente || '')}"`, 'k')}
        ${botao('Questionário com o cliente', `data-vc-quest="junto" data-vc-cli="${esc(o.cliente_id)}" data-vc-nome="${esc(o.cliente || '')}"`)}
        ${botao('Link do questionário', `data-vc-quest="link" data-vc-cli="${esc(o.cliente_id)}"`)}` : ''}
        ${botao('Ficha', `data-vc-cliente="${esc(o.cliente || '')}"`)}
        ${podeOnboarding(o.cliente_id) ? (o.encerrado_em ? '' : botao('Encerrar onboarding', `data-vc-onb="onboarding_encerrar" data-vc-cli="${esc(o.cliente_id)}"`)) : '<span class="v2c-sub">Só quem administra, o Atendimento e os heads do cliente mexem aqui.</span>'}</div>`;
    return `<li class="v2-abre v2c-linha v2c-onb${o.encerrado_em ? ' encerrado' : ''}" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="v2c-lin">
        <button type="button" class="v2c-abrir" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${o.cliente || 'Cliente'}: ${sit.texto}`)}">
          <span class="v2c-st"><span class="v2c-pill ${sit.tom}">${esc(sit.texto)}</span></span>
          <span class="v2c-nm">${cliCor(o.cliente || '')}</span>${tri}
          <span class="v2c-agora">${agora}</span>${progresso}${resp ? avatarHtml(resp) : '<span class="v2c-av vago" aria-hidden="true"></span>'}</button>
        <span class="v2c-ac">${acaoDaLinha}</span></div>
      <div class="v2-mais"><div><div class="v2c-det">${detalhe}${atalhos}</div></div></div></li>`;
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
  // "Como funciona": a esteira numerada, com os itens de cada etapa (a do servidor; sem ela, o caminho em três passos).
  function comoFuncionaHtml(etapas, padrao) {
    const passos = (etapas.length ? etapas : padrao || []).map((e) => [e.nome, plural(e.itens?.length || 0, 'item', 'itens'), (e.itens || []).map((i) => i.texto).join(' · ')]);
    const lista = passos.length ? passos : [['Cadastro', 'dados, contrato e acessos', ''], ['Questionário e kickoff', 'o cliente responde, o head conduz', ''], ['Checklist', 'Drive, grupo, primeiro planejamento', '']];
    return `<div class="v2c-card v2c-ajuda"><div class="v2c-card-topo"><h2>Como funciona a esteira</h2></div><ol class="vc-esteira vc-esteira-previa" aria-label="Etapas do onboarding">${lista.map(([nome, sub, itens], i) =>
      `<li${itens ? ` title="${esc(itens)}"` : ''}><i aria-hidden="true">${i + 1}</i><span>${esc(nome)}</span><small>${esc(sub)}</small></li>`).join('')}</ol>
      ${nota('Começa quando entra um cliente novo ou um contrato novo de um cliente da casa. Cada etapa tem o checklist e o responsável dela; "parada desde" mostra há quanto tempo a etapa atual não anda.')}</div>`;
  }
  function abaOnboarding() {
    const sv = estado.servidor;
    if (!sv) return { corpo: estado.erro ? vazio(estado.erro, secundario('Tentar de novo', 'data-vc-recarregar')) : '' };
    const etapas = sv.etapas || [], ligado = Boolean(sv.onboarding?.disponivel);
    if (ligado && estado.editorEtapas) return { corpo: editorEtapasHtml() };
    const lista = ligado ? sv.onboarding.clientes || [] : [];
    const emAberto = lista.filter((o) => !o.encerrado_em), encerrados = lista.filter((o) => o.encerrado_em);
    const ocupados = new Set(emAberto.map((o) => o.cliente_id));
    const candidatos = ligado ? (sv.clientes || []).filter((c) => c.ativo && !ocupados.has(c.id) && podeOnboarding(c.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) : [];
    // Onboarding começa por um fato novo (Paulo, 09/11/2026: "qual sentido de eu fazer onboard com quem já é cliente?"):
    // cliente novo (cadastro → esteira) ou contrato novo de um cliente da casa (renovação, serviço novo: esteira do zero).
    const podeNovo = ligado && typeof window.abrirCadastroCompleto === 'function' && (typeof podeEditarClientes !== 'function' || podeEditarClientes());
    const podeComecar = podeNovo || candidatos.length > 0;
    const topo = `${botao('Como funciona', `data-vc-ajuda aria-expanded="${estado.ajuda}"`, 'g')}
      ${botao('Novo onboarding', `data-vc-novo aria-expanded="${Boolean(estado.novoOnb)}"${podeComecar ? '' : ` disabled title="${ligado ? 'Só quem administra, o Atendimento e os heads começam um onboarding' : 'O onboarding ainda não foi ligado'}"`}`, 'p')}`;
    const contrato = estado.contratoNovo ? `<div class="vc-iniciar"><label class="vc-campo"><span>Cliente que fechou contrato novo</span><select data-vc-novo-onb>${candidatos.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
      ${botao('Cancelar', 'data-vc-contrato-novo')}${botao('Começar a esteira', 'data-vc-iniciar', 'k')}</div>` : '';
    const iniciar = estado.novoOnb && podeComecar ? `<section class="v2c-card v2c-painel vc-onb-comecar" aria-label="Começar um onboarding">
      <div class="vc-onb-caminhos">
        ${podeNovo ? `<button type="button" class="vc-onb-caminho" data-vc-onb-novo><b>Cliente novo</b><small>Cadastra o cliente e já abre a esteira, o questionário e o kickoff.</small></button>` : ''}
        ${candidatos.length ? `<button type="button" class="vc-onb-caminho" data-vc-contrato-novo aria-expanded="${Boolean(estado.contratoNovo)}"><b>Contrato novo</b><small>Cliente da casa que renovou ou fechou um serviço novo: a esteira começa do zero.</small></button>` : ''}
      </div>${contrato}</section>` : '';
    const ajuda = estado.ajuda ? comoFuncionaHtml(etapas, sv.etapas_padrao) : '';
    // Os três números: quem está entrando, quem parou há mais de 5 dias e quanto tempo leva uma entrada (dos encerrados).
    const sitDe = new Map(emAberto.map((o) => [o, situacaoDaLinha(o)]));
    const parados = emAberto.filter((o) => sitDe.get(o).tipo === 'parado').sort((a, b) => (b.situacao.atual?.dias_parada ?? 0) - (a.situacao.atual?.dias_parada ?? 0));
    const pedem = emAberto.filter((o) => sitDe.get(o).pede), pior = parados[0];
    const duracoes = encerrados.map((o) => (Date.parse(o.encerrado_em) - Date.parse(o.iniciado_em)) / 864e5).filter((d) => Number.isFinite(d) && d >= 0);
    const media = duracoes.length ? Math.max(1, Math.round(duracoes.reduce((t, d) => t + d, 0) / duracoes.length)) : null;
    const numeros = `<div class="v2c-tres">
        ${kpiHtml({ rotulo: 'Em entrada', valor: emAberto.length, tom: emAberto.length ? '' : 'quieto', sub: `<small>${emAberto.length ? `${plural(pedem.length, 'pede ação', 'pedem ação')} · ${emAberto.length - pedem.length} andando` : 'nenhum cliente em entrada'}</small>` })}
        ${kpiHtml({ rotulo: `Parados há mais de ${DIAS_PARADO} dias`, valor: parados.length, atraso: 0.12, tom: parados.length ? 'ruim' : 'quieto',
          sub: `<small>${pior ? `${esc(pior.cliente || '')} · parada desde ${dataCurta(diaDoCarimbo(pior.situacao.atual.parada_desde)).slice(0, 5)}` : 'nada parado'}</small>` })}
        ${kpiHtml({ rotulo: 'Tempo médio de entrada', valor: media == null ? '—' : plural(media, 'dia', 'dias'), atraso: 0.24, tom: media == null ? 'quieto' : '',
          sub: `<small>${media == null ? 'aparece quando o primeiro onboarding for encerrado' : `do começo da esteira ao encerramento · ${plural(duracoes.length, 'encerrado', 'encerrados')}`}</small>` })}
      </div>`;
    const fala = !ligado ? falaHtml('<b>Nenhum cliente</b> está em entrada. O onboarding ainda espera ser ligado; os donos já sabem o que falta.')
      : !emAberto.length ? falaHtml('<b>Nenhum cliente</b> está entrando agora. Quando fechar um cliente ou um contrato novo, comece por <b>Novo onboarding</b>.')
      : falaHtml(`<b>${plural(emAberto.length, 'cliente', 'clientes')}</b> ${emAberto.length === 1 ? 'está' : 'estão'} entrando.${!pior ? (pedem.length ? ` Nenhum travou, mas ${plural(pedem.length, 'pede', 'pedem')} uma ação sua.` : ' Nenhum travou.')
        : parados.length === 1 ? ` Só <b>${esc(pior.cliente || '')}</b> travou: ${esc(pior.situacao.atual?.nome || 'etapa')} há ${plural(pior.situacao.atual?.dias_parada ?? 0, 'dia', 'dias')}.`
        : ` ${parados.length} travaram; o mais parado é <b>${esc(pior.cliente || '')}</b>, há ${plural(pior.situacao.atual?.dias_parada ?? 0, 'dia', 'dias')}.`}`,
        pior ? botao(`Ver ${pior.cliente || 'o cliente'}`,`data-vc-abrir="o:${esc(pior.cliente_id)}" data-vc-focar="linha"`) : '');
    // Uma barra de filtro só: a busca, a etapa em que cada cliente está e "Filtros" (encerrados e o editor de etapas).
    const termo = semAcento(estado.buscaOnb).trim();
    const daEtapa = (id) => emAberto.filter((o) => !o.situacao.concluido && o.situacao.atual?.id === id).length;
    // Sem etapas do servidor (esteira ainda não ligada), as fichas mostram o caminho em três passos, zerado.
    const etapasDoFiltro = etapas.length ? etapas : sv.etapas_padrao?.length ? sv.etapas_padrao : [{ id: 'cadastro', nome: 'Cadastro' }, { id: 'kickoff', nome: 'Questionário e kickoff' }, { id: 'checklist', nome: 'Checklist' }];
    if (estado.etapaOnb !== 'todas' && !etapasDoFiltro.some((e) => e.id === estado.etapaOnb)) estado.etapaOnb = 'todas';
    const filtros = `<div class="v2c-filtros">
        <input type="search" class="v2c-busca" data-vc-busca-onb placeholder="Buscar cliente" aria-label="Buscar cliente em onboarding" value="${esc(estado.buscaOnb)}">
        <span class="v2c-chips" role="group" aria-label="Filtrar pela etapa">${ficha('Todas as etapas', emAberto.length, 'data-vc-etapa-onb="todas"', estado.etapaOnb === 'todas')}${etapasDoFiltro.map((e) => ficha(esc(e.nome), daEtapa(e.id), `data-vc-etapa-onb="${esc(e.id)}"`, estado.etapaOnb === e.id)).join('')}</span>
        ${botao('Filtros', `data-vc-filtros aria-expanded="${estado.filtros}"`)}
      </div>${estado.filtros ? `<div class="v2c-card v2c-painel v2c-painel-linha">${encerrados.length ? botao(`${estado.verEncerrados ? 'Esconder' : 'Ver'} encerrados (${encerrados.length})`, `data-vc-encerrados aria-expanded="${estado.verEncerrados}"`) : '<span class="v2c-sub">Nenhum onboarding encerrado ainda.</span>'}
        ${sv.pode?.etapas && ligado ? botao('Configurar etapas', 'data-vc-ed-abrir') : ''}</div>` : ''}`;
    const passa = (o) => (!termo || semAcento(o.cliente).includes(termo)) && (estado.etapaOnb === 'todas' || (!o.situacao.concluido && o.situacao.atual?.id === estado.etapaOnb));
    const porParada = (a, b) => (b.situacao.atual?.dias_parada ?? -1) - (a.situacao.atual?.dias_parada ?? -1);
    const pedeAcao = emAberto.filter((o) => passa(o) && sitDe.get(o).pede).sort(porParada), andando = emAberto.filter((o) => passa(o) && !sitDe.get(o).pede).sort(porParada);
    const limite = estado.limite.onboarding || PAGINA, cabem = andando.slice(0, Math.max(0, limite - pedeAcao.length)), resto = andando.length - cabem.length;
    const filtrando = Boolean(termo) || estado.etapaOnb !== 'todas';
    const secao = (titulo, lado, linhas) => `<div class="v2c-card-topo"><h2>${titulo}</h2><small>${lado}</small></div><ol class="v2c-lista">${linhas.map((o) => linhaOnboarding(o, etapas)).join('')}</ol>`;
    const quadro = !emAberto.length ? `<div class="v2c-card-topo"><h2>Pede ação</h2></div><div class="v2c-vazio"><p>Nenhum cliente em entrada.</p>${podeComecar ? botao('Novo onboarding', 'data-vc-novo', 'k') : ''}</div>`
      : !pedeAcao.length && !andando.length ? `<div class="v2c-card-topo"><h2>Pede ação</h2></div><div class="v2c-vazio"><p>Nenhum cliente neste filtro.</p>${botao('Ver todos', 'data-vc-etapa-onb="todas" data-vc-limpar')}</div>`
      : `${pedeAcao.length ? secao('Pede ação', `${plural(pedeAcao.length, 'coisa', 'coisas')}, na ordem`, pedeAcao) : filtrando ? '' : '<div class="v2c-card-topo"><h2>Pede ação</h2><small>nada pede ação agora</small></div>'}
        ${cabem.length ? secao('Andando', `${cabem.length + resto} sem pendência${encerrados.length ? ` · ${plural(encerrados.length, 'encerrado', 'encerrados')}` : ''}`, cabem) : ''}
        ${resto > 0 ? `<p class="v2c-pe">+ ${plural(resto, 'cliente', 'clientes')} andando · ${ligacao('mostrar', 'data-vc-mais="onboarding"')}</p>` : ''}`;
    const fechados = estado.verEncerrados && encerrados.length ? `<section class="v2c-card v2c-quadro" aria-label="Encerrados">${secao('Encerrados', plural(encerrados.length, 'onboarding', 'onboardings'), encerrados.filter((o) => !termo || semAcento(o.cliente).includes(termo)))}</section>` : '';
    // O rodapé do quadro: sem a esteira ligada, a frase do vazio e, para quem administra, o que falta.
    const pe = ligado ? '' : `<div class="v2c-rodape"><p class="v2c-sub"><b>O onboarding ainda não foi ligado</b> e nenhum cliente está em entrada. Ligado, cada etapa tem checklist e responsável, e "parada desde" mostra há quanto tempo ela não anda.${estado.verFalta && souAdminAqui()
      ? ` <small class="vc-ativacao-tec">Falta aplicar a migração <code>${esc(sv.migracao || '2026-11-07-carteira.sql')}</code> no banco. Depois disso, esta parte aparece sozinha.</small>` : ''}</p>
      ${souAdminAqui() ? botao('Para quem administra: ver o que falta', `data-vc-falta aria-expanded="${estado.verFalta}"`) : ''}</div>`;
    return { topo, corpo: `${ajuda}${iniciar}${fala}${numeros}${filtros}<section class="v2c-card v2c-quadro" aria-label="Clientes em entrada">${quadro}</section>${fechados}${pe}` };
  }

  // ---------- Churn ----------
  // ===== Churn e Contratos pelos quadros do moodboard (Paulo, 12/11/2026: "eu aprovei o DEPOIS") =====
  // As duas telas seguem a ordem dos quadros: título com "Como funciona" e a ação principal; a fala do agente; três
  // números; busca e fichas; "Pede ação" ao lado da lista (Contratos: com o mês a mês; Churn: com saídas e retenção).
  // Saíram do alto e continuam a um clique: o período (Mensal/Anual e o mês) e a ordem em "Filtros"; a conta do LTV,
  // do mês a mês e do churn em "Como funciona". O que vai ao servidor não mudou: formContrato e formChurn.
  const AGENTE_CONTRATOS = { nome: 'Vorcaro', papel: 'Financeiro e contratos' };
  const AGENTE_CHURN = { nome: 'VYBES', papel: 'Comercial' };
  const falaDe = (ag, frase, acaoHtml = '') => `<section class="v2c-card v2c-fala" aria-label="${esc(`${ag.nome}, ${ag.papel}`)}"><span class="v2c-ag" aria-hidden="true">${esc(ag.nome[0])}</span><p><span class="v2c-quem">${esc(ag.nome)} · ${esc(ag.papel)}</span>${frase}</p>${acaoHtml}</section>`;
  const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mesCurto = (ym) => MES_CURTO[Number(String(ym).slice(5, 7)) - 1] || '';
  const mesAno = (iso) => (iso ? `${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : '');
  const diaMes = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const reaisCurto = (v) => (v == null ? '—' : Math.abs(v) >= 1000 ? `R$ ${virgula(Math.round(v / 100) / 10)} mil` : reais(v));
  const mesesDe = (de, ate) => Math.max(0, Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5 / (S()?.DIAS_MES || 30.44)));
  const nomesEm = (nomes) => (nomes.length <= 2 ? nomes.map((n) => `<b>${esc(n)}</b>`).join(' e ') : `${nomes.slice(0, 2).map((n) => `<b>${esc(n)}</b>`).join(', ')} e mais ${nomes.length - 2}`);
  const fichaConta = (rotulo, n, attrs, ligada) => ficha(`${esc(rotulo)} · ${n}`, null, attrs, ligada);
  const buscaHtml = (rotulo) => `<input type="search" class="v2c-busca" data-vc-busca placeholder="Buscar cliente" aria-label="${esc(rotulo)}" value="${esc(estado.busca[estado.aba] || '')}">`;
  const termoDaBusca = () => semAcento(estado.busca[estado.aba] || '').trim();
  const ehAdminAqui = () => souAdminAqui();
  // O período e a ordem, que saíram do alto: Mensal/Anual, o mês e a ordem da lista.
  function painelPeriodo(lista, ordens) {
    return `<div class="v2c-card v2c-painel v2c-painel-linha v2k-painel"><span class="v2c-seg" role="group" aria-label="Período">${[['mensal', 'Mensal'], ['anual', 'Anual']].map(([k, r]) => `<button type="button" data-vc-tipo="${k}" aria-pressed="${estado.tipo === k}">${r}</button>`).join('')}</span>
      ${typeof vbMesHtml === 'function' ? vbMesHtml({ mes: estado.mes, max: hoje().slice(0, 7), attr: 'data-vc-mes-ir', ano: estado.tipo === 'anual' }) : ''}
      ${ordemHtml(lista, ordens)}</div>`;
  }
  // O rodapé tracejado do quadro: a parte ainda não ligada e, para quem administra, o que falta.
  const rodapeVazio = (titulo, texto) => `<div class="v2k-vz" role="note"><p><b>${esc(titulo)}</b> ${esc(texto)}${estado.verFalta && ehAdminAqui()
    ? ` <small class="vc-ativacao-tec">Falta aplicar a migração <code>${esc(estado.servidor?.migracao || '2026-11-07-carteira.sql')}</code> no banco. Depois disso, esta parte aparece sozinha.</small>` : ''}</p>
    ${ehAdminAqui() ? botao('Para quem administra: ver o que falta', `data-vc-falta aria-expanded="${estado.verFalta}"`) : ''}</div>`;
  const cartaoTopo = (titulo, lado = '') => `<div class="v2c-card-topo"><h2>${titulo}</h2>${lado ? `<small>${lado}</small>` : ''}</div>`;

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
  const podeChurn = () => Boolean(estado.servidor?.pode?.churn && estado.servidor?.churn?.disponivel);
  const motivoDaSaida = (s) => (s.motivo ? MOTIVOS()[s.motivo] || s.motivo : 'sem motivo');
  // Quem saiu: o nome e o porquê; à direita, quanto levou e quanto tempo ficou. Abre no lugar com a data e o motivo.
  function linhaSaidaQ(s) {
    const chave = `s:${s.id}`, formAqui = estado.form?.tipo === 'churn' && estado.form.id === s.id && estado.form.onde === 'lista';
    const aberto = formAqui || estado.abertos.has(chave);
    const porque = [s.tipo ? TIPOS()[s.tipo] : 'Sem tipo', String(motivoDaSaida(s)).toLowerCase()].join(' · ');
    const pode = podeChurn();
    return `<li class="v2-abre v2c-linha v2k-saiu" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="v2c-lin">
        <button type="button" class="v2c-abrir" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${s.nome}, ${porque}`)}">
          <span class="v2k-nome"><b>${cliCor(s.nome)}</b><small>${esc(porque)}</small></span>
          <span class="v2k-dir"><b>${s.receita == null ? 'sem valor' : `${esc(reais(s.receita))} por mês`}</b><small>${s.meses == null ? 'sem data de entrada' : `${esc(mesesTxt(s.meses))} na casa`}</small></span>
        </button></div>
      <div class="v2-mais"><div><div class="v2k-det">
        <p class="v2k-hist">Saiu em ${esc(dataCurta(s.saida))}${s.saidaFonte === 'ultima_peca' ? ' (estimada pela última peça)' : ''}${s.tipo ? ` · ${esc(TIPOS()[s.tipo])}` : ''} · ${esc(motivoDaSaida(s))}</p>
        ${s.detalhe || s.motivoLivre ? `<p class="v2k-hist">“${esc(s.detalhe || s.motivoLivre)}”</p>` : ''}
        ${pode && !formAqui ? `<p class="v2k-det-acoes">${botao(s.classificado ? 'Editar motivo' : 'Classificar a saída', `data-vc-form-abrir="churn" data-vc-cli="${esc(s.id)}" data-vc-onde="lista"`, 'k')}</p>` : ''}
        ${formAqui ? formChurn(s) : ''}
      </div></div></div></li>`;
  }
  function abaChurn() {
    const sv = estado.servidor;
    const ajudaHtml = estado.ajuda ? `<div class="v2c-card v2c-ajuda"><div class="vc-ajuda" role="note"><b>Como o churn é contado</b>
      <p>Quem saiu (pela desativação no cadastro), com tipo e motivo. Taxa = saídas ÷ clientes ativos no começo do período. Receita perdida = a receita mensal de quem saiu.</p>
      <p>${esc(COMO_CONTA_CHURN)} A retenção mostra quantos de cada mês de entrada seguiam ativos depois de 1, 2, 3, 6 e 12 meses.</p></div></div>` : '';
    const como = botao('Como funciona', `data-vc-ajuda aria-expanded="${estado.ajuda}" aria-label="Como funciona e como a taxa e a retenção são calculadas"`, 'g');
    if (sv?.aguardando) return { topo: `${como}${botao('Registrar saída', 'disabled title="O churn ainda não foi ligado"', 'p')}`,
      corpo: `${ajudaHtml}${falaDe(AGENTE_CHURN, '<b>O churn ainda não foi ligado.</b> Quando estiver, quem saiu, por quê e a receita perdida aparecem aqui.')}${rodapeVazio('O churn ainda não foi ligado.', 'Quando estiver ligado, quem saiu, por quê e a receita perdida aparecem aqui.')}` };
    if (!sv?.clientes) return { topo: como, corpo: vazio(estado.erro || 'A base de clientes não carregou.', secundario('Tentar de novo', 'data-vc-recarregar')) };
    const r = S().churn({ clientes: sv.clientes, registros: sv.churn?.registros || [], contratos: listaContratos(), tipo: estado.tipo, mes: estado.mes });
    const c = S().cohort({ clientes: sv.clientes, hoje: hoje() });
    const pode = podeChurn(), periodo = esc(r.periodo.rotulo);
    const ativosHoje = sv.clientes.filter((x) => x && x.id != null && x.ativo).length;
    const termo = termoDaBusca(), naBusca = (s) => !termo || semAcento(s.nome).includes(termo);
    // Topo: o período escolhido, "Como funciona" e "Registrar saída" (classifica uma saída que já aparece aqui).
    const semClass = r.todas.filter((s) => !s.classificado), saidasParaRegistrar = [...semClass, ...r.todas.filter((s) => s.classificado)];
    const tituloRegistrar = !pode ? (sv.churn?.disponivel ? 'Só quem administra registra a saída' : 'A classificação das saídas ainda não foi ligada') : !r.todas.length ? 'Ninguém saiu ainda: quem é desativado no cadastro aparece aqui' : '';
    const topo = `<span class="v2c-sub">${periodo}</span>${como}${botao('Registrar saída', `data-vc-registrar aria-expanded="${estado.registrar === estado.aba}"${tituloRegistrar ? ` disabled title="${esc(tituloRegistrar)}"` : ''}`, 'p')}`;
    const emRegistro = estado.form?.tipo === 'churn' && estado.form.onde === 'registrar' ? r.todas.find((s) => s.id === estado.form.id) : null;
    const registrar = estado.registrar === estado.aba && pode && r.todas.length ? `<section class="v2c-card v2c-painel v2k-registrar" aria-label="Registrar saída">
      ${emRegistro ? `<p class="v2k-registrar-quem"><b>${cliCor(emRegistro.nome)}</b> · saiu em ${esc(dataCurta(emRegistro.saida))}</p>${porQueHtml(emRegistro)}${formChurn(emRegistro)}`
        : `<label class="vc-campo"><span>Cliente que saiu</span><select data-vc-registrar-cli>${saidasParaRegistrar.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)} · saiu em ${esc(dataCurta(s.saida))}${s.classificado ? '' : ' · sem motivo'}</option>`).join('')}</select></label>
        ${botao('Cancelar', 'data-vc-registrar')}${botao('Continuar', 'data-vc-registrar-ir="churn"', 'k')}`}</section>` : '';
    // A fala: quantos saíram, quanto levaram e se falta motivo.
    const primeiroSem = r.lista.find((s) => !s.classificado);
    const fala = !r.saidas ? (r.todas.length
      ? falaDe(AGENTE_CHURN, `Ninguém saiu em <b>${periodo}</b>. No histórico, ${plural(r.todas.length, 'saída', 'saídas')}${semClass.length ? `, ${semClass.length} sem motivo` : ''}.`, botao('Ver o histórico', 'data-vc-hist-ch'))
      : falaDe(AGENTE_CHURN, '<b>Nenhum cliente saiu</b> até agora. Quem for desativado no cadastro aparece aqui para dizer por quê.'))
      : falaDe(AGENTE_CHURN, `<b>${plural(r.saidas, 'cliente saiu', 'clientes saíram')}</b> em ${periodo} e ${r.saidas === 1 ? 'levou' : 'levaram'} <b>${esc(reaisCurto(r.receitaPerdida))} por mês</b>.${r.semClassificar
        ? (r.saidas === 1 ? ' A saída está sem motivo.' : r.semClassificar === 1 ? ' Uma das saídas está sem motivo.' : ` ${r.semClassificar} saídas estão sem motivo.`)
        : r.principalMotivo ? ` O motivo que mais pesa: <b>${esc(r.principalMotivo.rotulo)}</b>.` : ''}`,
        primeiroSem && pode ? botao('Classificar agora', `data-vc-form-abrir="churn" data-vc-cli="${esc(primeiroSem.id)}" data-vc-onde="acao"`) : '');
    // Os três números.
    const porTipo = Object.keys(TIPOS()).map((k) => [k, r.lista.filter((s) => s.tipo === k).length]), semTipo = r.lista.filter((s) => !s.tipo).length;
    const vt = r.variacao.taxa, mudou = vt && vt.direcao !== 'igual' ? `<span class="v2c-pill ${vt.direcao === 'sobe' ? 'r' : 'g'}">${vt.direcao === 'sobe' ? 'subiu' : 'caiu'} ${virgula(Math.abs(vt.delta))} p.p.</span>` : '';
    const numeros = `<div class="v2c-tres">
        ${kpiHtml({ rotulo: 'Taxa de churn', valor: r.taxa == null ? '—' : `${virgula(r.taxa)}%`, extra: mudou ? ` ${mudou}` : '', tom: r.taxa ? '' : 'quieto',
          sub: `<small>${r.taxa == null ? 'sem cliente ativo no começo do período' : `${r.saidas} de ${r.ativosNoInicio} clientes no período`} · ${plural(ativosHoje, 'ativo', 'ativos')} hoje</small>` })}
        ${kpiHtml({ rotulo: 'Saídas', valor: r.saidas, atraso: 0.12, tom: r.saidas ? '' : 'quieto',
          sub: `<small>${[...porTipo.filter(([, n]) => n).map(([k, n]) => `${n} ${TIPO_CURTO[k] || k}`), semTipo ? `${semTipo} sem tipo` : '', r.tempoMedioMeses != null ? `${virgula(r.tempoMedioMeses)} meses até sair` : ''].filter(Boolean).join(' · ') || 'ninguém saiu no período'}</small>` })}
        ${kpiHtml({ rotulo: 'Receita perdida', valor: reaisCurto(r.receitaPerdida), atraso: 0.24, tom: r.receitaPerdida ? 'ruim' : 'quieto',
          sub: `<small>por mês${r.semReceita ? ` · ${plural(r.semReceita, 'saída sem valor', 'saídas sem valor')}` : ''}</small>` })}
      </div>`;
    // Busca, fichas (tipo e sem motivo) e "Filtros" (período e ordem).
    const base = estado.histCh ? r.todas : r.lista;
    const FICHAS = [['todas', 'Todas', () => true], ...Object.keys(TIPOS()).map((k) => [k, TIPO_FICHA[k] || TIPOS()[k], (s) => s.tipo === k]), ['sem', 'Sem motivo', (s) => !s.classificado]];
    if (!FICHAS.some(([k]) => k === estado.filtroCh)) estado.filtroCh = 'todas';
    const filtros = `<div class="v2c-filtros">${buscaHtml('Buscar saída por cliente')}
        <span class="v2c-chips" role="group" aria-label="Filtrar as saídas">${FICHAS.map(([k, rot, f]) => [k, rot, base.filter(f).length]).filter(([k, , n]) => n || ['todas', 'cancelamento', 'nao_renovou', 'sem'].includes(k)).map(([k, rot, n]) => fichaConta(rot, n, `data-vc-filtro-ch="${k}"`, estado.filtroCh === k)).join('')}</span>
        ${botao('Filtros', `data-vc-filtros aria-expanded="${estado.filtros}"`)}
      </div>${estado.filtros ? painelPeriodo('churn', [['recente', 'Mais recente primeiro'], ['receita', 'Maior receita primeiro'], ['nome', 'Nome A–Z']]) : ''}`;
    // Pede ação: saída sem motivo e cliente que pode sair (risco alto na Saúde, com a renovação perto quando houver).
    const ctr = contratosAgora(), linhaDe = new Map((ctr?.linhas || []).map((l) => [l.id, l]));
    const semMotivo = r.lista.filter((s) => !s.classificado && naBusca(s));
    const risco = (estado.saude?.clientes || []).filter((x) => x.risco === 'alto' && x.id && naBusca(x)).map((x) => ({ x, l: linhaDe.get(String(x.id)) }))
      .sort((a, b) => Number(Boolean(b.l?.emBreve || b.l?.vencida)) - Number(Boolean(a.l?.emBreve || a.l?.vencida)) || a.x.score - b.x.score).slice(0, 2);
    const itemSem = (s) => {
      const formAqui = estado.form?.tipo === 'churn' && estado.form.id === s.id && estado.form.onde === 'acao';
      return `<li class="v2k-acao"><span class="v2c-pill r">Sem motivo</span><p><span class="v2k-cli">${cliCor(s.nome)}</span> · desativado em ${esc(diaMes(s.saida))}${s.receita != null ? `, ${esc(reais(s.receita))} por mês` : ''} · falta o motivo</p>
        ${pode && !formAqui ? botao('Classificar a saída', `data-vc-form-abrir="churn" data-vc-cli="${esc(s.id)}" data-vc-onde="acao"`) : ''}
        ${formAqui ? `<div class="v2k-acao-form">${porQueHtml(s)}${formChurn(s)}</div>` : ''}</li>`;
    };
    const itemRisco = ({ x, l }) => `<li class="v2k-acao"><span class="v2c-pill a">Pode sair</span><p><span class="v2k-cli">${cliCor(x.nome)}</span> · nota ${x.score} na Saúde da carteira${l?.vencida ? ` e renovação vencida em ${esc(diaMes(l.renovacao))}` : l?.emBreve ? ` e contrato vencendo em ${plural(l.diasRenovacao, 'dia', 'dias')}` : ''}</p>
        ${botao('Abrir o cliente', `data-vc-cliente="${esc(x.nome)}"`)}</li>`;
    const nAcao = semMotivo.length + risco.length;
    const pedeAcao = `${cartaoTopo('Pede ação', nAcao ? `${plural(nAcao, 'coisa', 'coisas')}, na ordem` : 'nada pede ação agora')}
      ${nAcao ? `<ol class="v2c-lista v2k-acoes">${semMotivo.map(itemSem).join('')}${risco.map(itemRisco).join('')}</ol>` : ''}`;
    // Quem saiu: no período (ou o histórico inteiro), pela ficha e pela busca.
    const passa = FICHAS.find(([k]) => k === estado.filtroCh)[2];
    let lista = base.filter((s) => passa(s) && naBusca(s));
    if (estado.ordem.churn === 'receita') lista = [...lista].sort((a, b) => (b.receita ?? -1) - (a.receita ?? -1));
    else if (estado.ordem.churn === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const limite = estado.limite.churn || PAGINA_QUADRO, resto = lista.length - limite;
    const quemSaiu = `<div class="v2c-card-topo v2k-quem-saiu"><h2>${estado.histCh ? 'Quem já saiu' : 'Quem saiu'} · ${lista.length}</h2><small>${r.todas.length ? ligacao(estado.histCh ? `só ${r.periodo.rotulo}` : 'mostrar o histórico', 'data-vc-hist-ch') : ''}</small></div>
      ${lista.length ? `<ol class="v2c-lista">${lista.slice(0, limite).map(linhaSaidaQ).join('')}</ol>${resto > 0 ? `<p class="v2c-pe">+ ${plural(resto, 'saída', 'saídas')} · ${ligacao('mostrar', 'data-vc-mais="churn"')}</p>` : ''}`
        : `<div class="v2c-vazio"><p>${termo || estado.filtroCh !== 'todas' ? 'Nenhuma saída neste filtro.' : estado.histCh ? 'Ninguém saiu até agora.' : `Ninguém saiu em ${periodo}.`}</p>${termo || estado.filtroCh !== 'todas' ? botao('Ver todas', 'data-vc-filtro-ch="todas" data-vc-limpar') : ''}</div>`}`;
    // Saídas e retenção: motivos, saídas por mês e a retenção por mês de entrada.
    const serie = serieDosMeses();
    if (serie) guardarBase();
    const VISTAS = [['motivos', 'Motivos'], ['meses', 'Saídas por mês'], ['retencao', 'Retenção']];
    if (!VISTAS.some(([k]) => k === estado.vistaCh)) estado.vistaCh = 'motivos';
    const contagem = [...r.porMotivo.map((m) => ({ rotulo: m.rotulo, vezes: base.filter((s) => s.motivo === m.motivo).length, cor: '#1F1D1A' })).sort((a, b) => b.vezes - a.vezes),
      { rotulo: 'Sem motivo', vezes: base.filter((s) => !s.motivo).length, cor: '#C9C2B6' }].filter((m) => m.vezes);
    const vista = estado.vistaCh === 'meses' ? (serie && serie.meses.some((p) => Number(p.saidas) > 0 || Number(p.novos) > 0) ? `<div class="vc-grafs v2k-grafs">
          ${barrasMes(serie.meses, 'saidas', { titulo: 'Clientes que saíram', cor: '#D93D42', fraca: '#F2C4C6', formato: String, espiar: (p) => `mes:saidas:${p.mes}`, zero: 'Ninguém saiu nestes meses.' })}
          ${barrasMes(serie.meses, 'novos', { titulo: 'Clientes que entraram', cor: '#18A957', fraca: '#BFE6CF', formato: String, espiar: (p) => `mes:novos:${p.mes}`, zero: 'Ninguém entrou nestes meses.' })}</div>`
        : '<div class="v2c-vazio"><p>Ninguém saiu nem entrou nestes meses. As barras aparecem quando houver cliente com data de entrada ou de saída.</p></div>')
      : estado.vistaCh === 'retencao' ? cohortHtml(c)
      : contagem.length ? `<div class="v2k-motivos">${contagem.map((m) => `<p class="v2k-mot"><span>${esc(m.rotulo)}</span><span class="v2c-sub">${m.vezes}</span></p><div class="v2-barra"><i style="--v:${Math.round((m.vezes / Math.max(1, base.length)) * 100)}%;--c:${m.cor}"></i></div>`).join('')}</div>`
      : `<div class="v2c-vazio"><p>${estado.histCh ? 'Nenhuma saída até agora.' : `Nenhuma saída em ${periodo}.`}</p></div>`;
    const ultimos = serie ? serie.meses.slice(-6).filter((p) => Number(p.saidas) > 0).map((p) => mesCurto(p.mes)) : [];
    const totalSerie = serie ? serie.meses.reduce((t, p) => t + (Number(p.saidas) || 0), 0) : 0;
    const peDaVista = serie ? `${totalSerie ? `${plural(totalSerie, 'saída', 'saídas')} em ${serie.meses.length} meses${ultimos.length ? ` (${ultimos.length > 1 ? `${ultimos.slice(0, -1).join(', ')} e ${ultimos.at(-1)}` : ultimos[0]} nos últimos seis)` : ''}.` : `Ninguém saiu nos últimos ${serie.meses.length} meses.`} “Retenção” mostra quantos ficaram, por mês de entrada.` : '“Retenção” mostra quantos ficaram, por mês de entrada.';
    const lado = `<section class="v2c-card v2k-lado" aria-label="Saídas e retenção"><h2>Saídas e retenção</h2>
        <p class="v2k-seg"><span class="v2c-seg" role="group" aria-label="Ver">${VISTAS.map(([k, rot]) => `<button type="button" data-vc-vista-ch="${k}" aria-pressed="${estado.vistaCh === k}">${rot}</button>`).join('')}</span></p>
        <div class="v2k-vista">${vista}</div><p class="v2c-pe">${esc(peDaVista)}</p></section>`;
    const rodape = sv.churn?.disponivel ? '' : rodapeVazio('A classificação das saídas ainda não foi ligada.', 'As saídas já aparecem pela desativação do cliente; o motivo de cada uma passa a ser guardado quando estiver ligada.');
    return { topo, corpo: `${ajudaHtml}${registrar}${fala}${numeros}${filtros}
      <div class="v2k-grade2 v2k-churn"><section class="v2c-card v2c-quadro v2k-esq" aria-label="Pede ação e quem saiu">${pedeAcao}${quemSaiu}</section>${lado}</div>${rodape}` };
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
    return `Cada mês na data do último dia (o mês corrente, hoje). Ativos = entraram até ali e não tinham saído${s?.semEntrada ? ` (${plural(s.semEntrada, 'cliente sem data de entrada conta', 'clientes sem data de entrada contam')} como antigo)` : ''}. Ticket = receita mensal ativa ÷ clientes ativos com valor. As saídas por mês ficam na tela Churn.`;
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
  const podeContratos = () => Boolean(estado.servidor?.pode?.contratos && estado.servidor?.contratos?.disponivel);
  const contratoDaFin = (id) => window.VybeFinancas?.contratoDoCliente?.(id) || null;
  // A trilha do contrato: do início à renovação, quanto já passou. Vermelho venceu, âmbar renova em 30 dias.
  function trilha(l) {
    if (!l.temContrato) return { pct: 0, cor: '#B42318', texto: 'sem contrato' };
    if (l.status === 'encerrado') return { pct: 100, cor: '#C9C2B6', texto: 'contrato encerrado' };
    if (!l.inicio || !l.renovacao) return { pct: 0, cor: '#11613A', texto: l.renovacao ? `renova em ${dataCurta(l.renovacao)}` : 'sem renovação marcada' };
    const total = Math.max(1, mesesDe(l.inicio, l.renovacao)), passou = l.vencida ? total : hoje() < l.inicio ? 0 : Math.min(total, mesesDe(l.inicio, hoje()));
    const pct = l.vencida ? 100 : Math.min(100, Math.max(0, Math.round(((Date.parse(hoje()) - Date.parse(l.inicio)) / Math.max(1, Date.parse(l.renovacao) - Date.parse(l.inicio))) * 100)));
    return { pct, cor: l.vencida ? '#B42318' : l.emBreve ? '#9A5B00' : '#11613A', texto: `${passou} de ${plural(total, 'mês', 'meses')}` };
  }
  const pilulaRenovacao = (l) => (!l.temContrato ? '<span class="v2c-pill r">Sem contrato</span>'
    : l.status === 'encerrado' ? '<span class="v2c-pill">Encerrado</span>'
    : l.vencida ? `<span class="v2c-pill r">venceu ${esc(diaMes(l.renovacao))}</span>`
    : l.emBreve ? `<span class="v2c-pill a">${esc(diaMes(l.renovacao))} · ${l.diasRenovacao ? plural(l.diasRenovacao, 'dia', 'dias') : 'hoje'}</span>`
    : l.renovacao ? `<span class="v2c-pill">${esc(mesAno(l.renovacao))}</span>` : '<span class="v2c-pill">sem data</span>');
  // A linha do cliente ativo: nome e desde quando, a trilha até a renovação, o valor e a data. Abre no lugar.
  function linhaContratoQ(l) {
    const chave = `k:${l.id}`, formAqui = estado.form?.tipo === 'contrato' && estado.form.id === l.id && estado.form.onde === 'lista';
    const aberto = formAqui || estado.abertos.has(chave), t = trilha(l), fc = contratoDaFin(l.id), pode = !fc && podeContratos();
    const [rotStatus] = STATUS_CONTRATO[l.status] || ['Sem contrato'];
    const hist = [l.temContrato ? [l.inicio ? `Início em ${S().util?.nomeDoMes ? S().util.nomeDoMes(l.inicio.slice(0, 7)) : dataCurta(l.inicio)}` : 'Sem data de início', l.renovacao ? `renovação em ${diaMes(l.renovacao)}${l.renovacao.slice(0, 4) !== hoje().slice(0, 4) ? `/${l.renovacao.slice(2, 4)}` : ''}` : 'sem renovação marcada', rotStatus].join(' · ') : 'Sem contrato registrado',
      [l.valor != null ? `${reais(l.valor)} por mês${l.valorDoCadastro ? ' (do cadastro)' : ''}` : 'sem valor mensal', l.mesesLtv != null ? `na casa há ${mesesTxt(l.mesesLtv)}` : 'sem data de entrada', l.receitaLtv != null ? `LTV estimado ${reais(l.receitaLtv)}` : ''].filter(Boolean).join(' · ')];
    const daFin = fc ? `<p class="v2k-hist">${esc(['Vybe Finanças: ' + fc.titulo, fc.assinado_em ? 'assinado em ' + dataCurta(fc.assinado_em) : 'sem data de assinatura', fc.dia_vencimento ? 'vence dia ' + fc.dia_vencimento : '', fc.status, fc.tem_pdf ? 'com PDF' : 'sem PDF'].filter(Boolean).join(' · '))}</p>` : '';
    const acoes = `${pode ? botao(l.temContrato ? 'Abrir o contrato' : 'Registrar contrato', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}" data-vc-onde="lista"`, 'k') : ''}${pode && l.temContrato ? botao('Mudar a data', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}" data-vc-onde="lista" data-vc-campo="renovacao"`) : ''}${botao('Abrir o cliente', `data-vc-cliente="${esc(l.nome)}"`)}`;
    return `<li class="v2-abre v2c-linha v2k-ct" data-vc-linha="${esc(chave)}" aria-expanded="${aberto}"><div class="v2c-lin">
        <button type="button" class="v2c-abrir v2k-linha-ct" data-vc-abrir="${esc(chave)}" aria-expanded="${aberto}" aria-label="${esc(`${l.nome}, ${l.valor == null ? 'sem valor' : `${reais(l.valor)} por mês`}, ${t.texto}`)}">
          <span class="v2k-nome"><b>${cliCor(l.nome)}</b><small>${l.entrada ? `desde ${esc(mesAno(l.entrada))}` : 'sem data de entrada'}</small></span>
          <span class="v2k-trilha"><span class="v2-barra"><i style="--v:${t.pct}%;--c:${t.cor}"></i></span><small>${esc(t.texto)}</small></span>
          <b class="v2k-valor">${l.valor == null ? '—' : esc(reais(l.valor))}</b>${pilulaRenovacao(l)}</button></div>
      <div class="v2-mais"><div><div class="v2k-det">
        ${hist.map((h) => `<p class="v2k-hist">${esc(h)}</p>`).join('')}${daFin}${l.observacao ? `<p class="v2k-hist">“${esc(l.observacao)}”</p>` : ''}
        ${formAqui ? formContrato(l) : `<p class="v2k-det-acoes">${acoes}</p>`}
      </div></div></div></li>`;
  }
  function abaContratos() {
    const sv = estado.servidor, f = finCarteira();
    const como = botao('Como funciona', `data-vc-ajuda aria-expanded="${estado.ajuda}" aria-label="Como funciona e como o LTV é calculado"`, 'g');
    if (sv?.aguardando) return { topo: `${como}${botao('Registrar contrato', 'disabled title="Os contratos ainda não foram ligados"', 'p')}`,
      corpo: `${falaDe(AGENTE_CONTRATOS, '<b>Os contratos ainda não foram ligados.</b> Quando estiverem, o valor, o início e a renovação de cada cliente aparecem aqui.')}${rodapeVazio('Os contratos ainda não foram ligados.', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente aparecem aqui. Nada se perde até lá.')}` };
    if (!sv?.clientes) return { topo: como, corpo: vazio(estado.erro || 'A base de clientes não carregou.', secundario('Tentar de novo', 'data-vc-recarregar')) };
    const r = S().contratos({ clientes: sv.clientes, contratos: listaContratos(), hoje: hoje(), tipo: estado.tipo, mes: estado.mes });
    espiarCarteira.contratos = r;
    const pode = podeContratos(), termo = termoDaBusca(), naBusca = (l) => !termo || semAcento(l.nome).includes(termo);
    const serie = serieDosMeses();
    if (serie) guardarBase();
    const dicaLtv = `LTV = meses desde o início do contrato (sem contrato, a data de entrada no cadastro) até hoje, só clientes ativos. Receita estimada = valor mensal × meses de casa.${r.semDataLtv ? ` ${plural(r.semDataLtv, 'cliente sem data fica', 'clientes sem data ficam')} fora da média.` : ''} Tempo restante = dias até a renovação dos contratos abertos que ainda não venceram${r.restanteMedio ? ` (${plural(r.restanteMedio.contratos, 'contrato', 'contratos')})` : ''}.`;
    const ajudaHtml = estado.ajuda ? `<div class="v2c-card v2c-ajuda"><div class="vc-ajuda" role="note"><b>Como os contratos funcionam</b>
      <p>Valor mensal, início, renovação e status de cada cliente ativo. Renovações dos próximos 30 dias ficam em "Pede ação"; a trilha da linha mostra quanto do contrato já passou.</p>
      <p>${esc(dicaLtv)}</p><p>${esc(comoContaMesAMes(serie))}</p></div></div>` : '';
    // Topo: "Registrar contrato" escolhe o cliente e abre o mesmo formulário de sempre.
    const fora = (l) => Boolean(contratoDaFin(l.id));
    const candidatos = [...r.linhas.filter((l) => !l.temContrato && !fora(l)), ...r.linhas.filter((l) => l.temContrato && !fora(l)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))];
    const tituloRegistrar = !pode ? (sv.contratos?.disponivel ? 'Valor e contrato só quem administra altera' : 'Os contratos ainda não foram ligados') : !candidatos.length ? 'Nenhum cliente ativo no cadastro' : '';
    const topo = `${estado.tipo === 'anual' || estado.mes !== hoje().slice(0, 7) ? `<span class="v2c-sub">${esc(r.periodo.rotulo)}</span>` : ''}${como}${botao('Registrar contrato', `data-vc-registrar aria-expanded="${estado.registrar === estado.aba}"${tituloRegistrar ? ` disabled title="${esc(tituloRegistrar)}"` : ''}`, 'p')}`;
    const emRegistro = estado.form?.tipo === 'contrato' && estado.form.onde === 'registrar' ? r.linhas.find((l) => l.id === estado.form.id) : null;
    const registrar = estado.registrar === estado.aba && pode && candidatos.length ? `<section class="v2c-card v2c-painel v2k-registrar" aria-label="Registrar contrato">
      ${emRegistro ? `<p class="v2k-registrar-quem"><b>${cliCor(emRegistro.nome)}</b> · ${emRegistro.temContrato ? 'contrato registrado: os campos abaixo substituem o atual' : 'sem contrato ainda'}</p>${formContrato(emRegistro)}`
        : `<label class="vc-campo"><span>Cliente</span><select data-vc-registrar-cli>${candidatos.map((l) => `<option value="${esc(l.id)}">${esc(l.nome)}${l.temContrato ? '' : ' · sem contrato'}</option>`).join('')}</select></label>
        ${botao('Cancelar', 'data-vc-registrar')}${botao('Continuar', 'data-vc-registrar-ir="contrato"', 'k')}`}</section>` : '';
    // A fala do Vorcaro: quanto entra por mês, o que renova em 30 dias e quem está sem contrato.
    const abertos = r.linhas.filter((l) => l.temContrato && l.status !== 'encerrado').length;
    const semNomes = r.linhas.filter((l) => !l.temContrato).map((l) => l.nome);
    const breve = r.emBreve.length, vencidas = r.vencidas.length;
    const fala = !r.linhas.length ? falaDe(AGENTE_CONTRATOS, '<b>Nenhum cliente ativo</b> no cadastro. Quem entra no cadastro como ativo aparece aqui com o contrato.')
      : falaDe(AGENTE_CONTRATOS, `<b>${esc(reaisCurto(r.receita))} por mês</b> ${abertos ? `em ${plural(abertos, 'contrato ativo', 'contratos ativos')}` : `nos ${plural(r.linhas.length, 'cliente ativo', 'clientes ativos')}`}.${vencidas ? ` <b>${plural(vencidas, 'renovação venceu', 'renovações venceram')}</b>${breve ? ` e ${breve} ${breve === 1 ? 'renova' : 'renovam'} em 30 dias` : ''}.` : breve ? ` <b>${breve} ${breve === 1 ? 'renova' : 'renovam'} em 30 dias</b>.` : ' Nenhuma renovação nos próximos 30 dias.'}${semNomes.length ? ` ${semNomes.length === 1 ? '1 cliente está' : `${semNomes.length} clientes estão`} sem contrato.` : ''}`,
        vencidas + breve ? botao(vencidas + breve === 1 ? 'Ver a renovação' : `Ver os ${vencidas + breve}`, 'data-vc-filtro-ct="breve"') : semNomes.length ? botao(semNomes.length === 1 ? 'Ver quem' : `Ver os ${semNomes.length}`, 'data-vc-filtro-ct="sem"') : '');
    // Os três números.
    const vr = r.variacao.receita, mudou = vr && vr.direcao !== 'igual' ? `<span class="v2c-pill ${vr.direcao === 'sobe' ? 'g' : 'a'}">${vr.direcao === 'sobe' ? '+' : '−'}${esc(reaisCurto(Math.abs(vr.delta)))} no ${estado.tipo === 'anual' ? 'ano' : 'mês'}</span>` : '';
    const emJogo = [...r.emBreve, ...r.vencidas].reduce((t, l) => t + (l.valor || 0), 0);
    const comLtv = r.linhas.length - r.semReceitaLtv;
    const numeros = `<div class="v2c-tres">
        ${kpiHtml({ rotulo: 'Em contratos ativos', valor: reaisCurto(r.receita), extra: mudou ? ` ${mudou}` : '', tom: r.receita ? '' : 'quieto',
          sub: `<small>por mês · ${plural(r.linhas.length, 'ativo', 'ativos')} · ${r.ticketMedio == null ? 'ticket médio: sem valor' : `ticket médio ${esc(reaisCurto(r.ticketMedio))}`}</small>` })}
        ${kpiHtml({ rotulo: 'Renovam em 30 dias', valor: breve, atraso: 0.12, tom: breve ? 'amarelo' : 'quieto',
          sub: `<small>${breve ? `<span class="v2k-espia" data-espiar="carteira:contratos:breve" role="button" tabindex="0">${esc(reaisCurto(emJogo))} por mês em jogo</span>` : 'nenhuma nos próximos 30 dias'}${vencidas ? ` · <span class="v2k-ruim">${plural(vencidas, 'vencida', 'vencidas')}</span>` : ''}</small>` })}
        ${kpiHtml({ rotulo: 'Tempo de casa (LTV)', valor: r.ltvMedio == null ? '—' : mesesTxt(Math.round(r.ltvMedio)), atraso: 0.24, tom: r.ltvMedio == null ? 'quieto' : '',
          sub: `<small>${r.receitaLtv == null ? 'receita do LTV: sem valor ou sem data' : `<span class="v2k-espia" data-espiar="carteira:ltv:receita" role="button" tabindex="0">receita do LTV: ${esc(reaisCurto(r.receitaLtv / Math.max(1, comLtv)))} por cliente</span>`}</small>` })}
      </div>`;
    // Busca, fichas e "Filtros" (período e ordem).
    const FICHAS = [['todos', 'Todos os clientes ativos', () => true], ['breve', vencidas ? 'Vencidas e em 30 dias' : 'Renovam em 30 dias', (l) => l.emBreve || l.vencida], ['sem', 'Sem contrato', (l) => !l.temContrato]];
    if (!FICHAS.some(([k]) => k === estado.filtroCt)) estado.filtroCt = 'todos';
    const filtros = `<div class="v2c-filtros">${buscaHtml('Buscar contrato por cliente')}
        <span class="v2c-chips" role="group" aria-label="Filtrar os clientes">${FICHAS.map(([k, rot, f2]) => [k, rot, r.linhas.filter(f2).length]).map(([k, rot, n]) => fichaConta(rot, n, `data-vc-filtro-ct="${k}"`, estado.filtroCt === k)).join('')}</span>
        ${botao('Filtros', `data-vc-filtros aria-expanded="${estado.filtros}"`)}
      </div>${estado.filtros ? painelPeriodo('contratos', [['renovacao', 'Renovação mais próxima'], ['valor', 'Maior valor primeiro'], ['nome', 'Nome A–Z']]) : ''}`;
    // Pede ação: renovação vencida ou em 30 dias (na ordem da data) e, num item só, quem está sem contrato.
    const itemRenova = (l) => {
      const formAqui = estado.form?.tipo === 'contrato' && estado.form.id === l.id && estado.form.onde === 'acao', fc = contratoDaFin(l.id);
      const pilula = l.vencida ? `<span class="v2c-pill r">Renovação vencida em ${esc(diaMes(l.renovacao))}</span>` : `<span class="v2c-pill a">${l.diasRenovacao ? `Renova em ${plural(l.diasRenovacao, 'dia', 'dias')}` : 'Renova hoje'}</span>`;
      return `<li class="v2k-acao v2k-acao-ct"><div class="v2k-acao-tx">${pilula}<p><span class="v2k-cli">${cliCor(l.nome)}</span>${l.valor != null ? ` · ${esc(reais(l.valor))} por mês` : ''}${l.mesesLtv != null ? ` · na casa há ${esc(mesesTxt(l.mesesLtv))}` : ''}</p></div>
        ${formAqui ? '' : !fc && pode ? botao('Renovar', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}" data-vc-onde="acao" data-vc-campo="renovacao"`) : botao('Abrir o cliente', `data-vc-cliente="${esc(l.nome)}"`)}
        ${formAqui ? `<div class="v2k-acao-form">${formContrato(l)}</div>` : ''}</li>`;
    };
    const renova = [...r.vencidas, ...r.emBreve].filter(naBusca), semC = r.linhas.filter((l) => !l.temContrato && naBusca(l));
    const mostra = renova.slice(0, 2), sobra = renova.length - mostra.length, nAcao = renova.length + (semC.length ? 1 : 0);
    const itemSem = semC.length ? `<li class="v2k-acao v2k-acao-ct"><div class="v2k-acao-tx"><span class="v2c-pill r">Sem contrato</span><p>${nomesEm(semC.map((l) => l.nome))} · ${semC.length === 1 ? 'ativo' : 'ativos'}, sem valor mensal nem início</p></div>
        ${botao(pode ? (semC.length === 1 ? 'Registrar o contrato' : `Registrar os ${semC.length}`) : semC.length === 1 ? 'Ver o cliente' : `Ver os ${semC.length}`, 'data-vc-filtro-ct="sem"')}</li>` : '';
    const pedeAcao = `<section class="v2c-card v2k-pede" aria-label="Pede ação">${cartaoTopo('Pede ação', nAcao ? `${plural(nAcao, 'coisa', 'coisas')}, na ordem` : 'nada pede ação agora')}
      ${nAcao ? `<ol class="v2c-lista v2k-acoes">${mostra.map(itemRenova).join('')}${itemSem}</ol>${sobra > 0 ? `<p class="v2c-pe">+ ${plural(sobra, 'renovação', 'renovações')} · ${ligacao('mostrar', 'data-vc-filtro-ct="breve"')}</p>` : ''}`
        : `<div class="v2c-vazio"><p>${r.linhas.length ? 'Nenhuma renovação nos próximos 30 dias e todo cliente ativo tem contrato.' : 'Nenhum cliente ativo no cadastro.'}</p></div>`}</section>`;
    // Mês a mês: uma série de cada vez (ativos, novos, LTV ou ticket), os últimos seis meses, o mês de agora em laranja.
    const SERIES = [['ativos', 'Ativos', String], ['novos', 'Novos', String], ['ltvMedio', 'LTV', (x) => `${virgula(x)} meses`], ['ticketMedio', 'Ticket', (x) => reais(x)]];
    if (!SERIES.some(([k]) => k === estado.serieCt)) estado.serieCt = 'ativos';
    const [campo, rotSerie, fmt] = SERIES.find(([k]) => k === estado.serieCt);
    const pontos = serie ? serie.meses.slice(-6) : [], maxSerie = Math.max(1, ...pontos.map((p) => Number(p[campo]) || 0));
    const colunas = !mesAMesTemDado(serie) ? '<div class="v2c-vazio"><p>O gráfico aparece com a primeira data de entrada de um cliente ativo.</p></div>'
      : `<div class="v2k-cols" role="img" aria-label="${esc(`${rotSerie} mês a mês: ${pontos.map((p) => `${mesCurto(p.mes)} ${p[campo] == null ? 'sem dado' : fmt(p[campo])}`).join(', ')}`)}">${pontos.map((p) => {
        const v = Number(p[campo]) || 0, espia = campo === 'novos' && v ? ` data-espiar="carteira:mes:novos:${esc(p.mes)}" role="button" tabindex="0"` : '';
        return `<div class="v2k-col${p.agora ? ' agora' : ''}" title="${esc(`${mesCurto(p.mes)}: ${p[campo] == null ? 'sem dado' : fmt(p[campo])}`)}"${espia}><i style="--h:${v ? Math.max(4, Math.round((v / maxSerie) * 100)) : 2}%"></i><span>${mesCurto(p.mes)}</span></div>`;
      }).join('')}</div>`;
    const mesAMes = `<section class="v2c-card v2k-meses" aria-label="Mês a mês"><div class="v2k-meses-topo"><h2>Mês a mês</h2><span class="v2c-chips" role="group" aria-label="Série">${SERIES.map(([k, rot]) => ficha(rot, null, `data-vc-serie-ct="${k}"`, estado.serieCt === k)).join('')}</span></div>${colunas}</section>`;
    // Clientes ativos: a lista pela ficha, pela busca e pela ordem de "Filtros".
    const [, rotFicha, passaFicha] = FICHAS.find(([k]) => k === estado.filtroCt);
    let lista = r.linhas.filter((l) => passaFicha(l) && naBusca(l));
    if (estado.ordem.contratos === 'valor') lista = [...lista].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    else if (estado.ordem.contratos === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const limite = estado.limite.contratos || 4, resto = lista.length - limite;
    const restante = r.restanteMedio ? `em média ${restanteTxt(r.restanteMedio.dias).replace('faltam ', '')} até a renovação` : 'sem renovação marcada';
    const novosTxt = `<span class="v2k-espia" data-espiar="carteira:novos:periodo" role="button" tabindex="0">${plural(r.novos.length, 'novo', 'novos')} no ${estado.tipo === 'anual' ? 'ano' : 'mês'}</span>`;
    const titulo = estado.filtroCt === 'todos' ? 'Clientes ativos' : rotFicha;
    const filtrando = Boolean(termo) || estado.filtroCt !== 'todos';
    const clientes = `<section class="v2c-card v2c-quadro v2k-clientes" aria-label="${esc(titulo)}">${cartaoTopo(`${esc(titulo)} · ${lista.length}`, `${novosTxt} · ${esc(restante)}`)}
      ${lista.length ? `<ol class="v2c-lista">${lista.slice(0, limite).map(linhaContratoQ).join('')}</ol>`
        : `<div class="v2c-vazio"><p>${filtrando ? 'Nenhum cliente neste filtro.' : 'Nenhum cliente ativo no cadastro. Quem entra no cadastro como ativo aparece aqui.'}</p>${filtrando ? botao('Ver todos', 'data-vc-filtro-ct="todos" data-vc-limpar') : ''}</div>`}
      ${resto > 0 ? `<p class="v2c-pe">+ ${plural(resto, estado.filtroCt === 'todos' ? 'cliente ativo' : 'cliente', estado.filtroCt === 'todos' ? 'clientes ativos' : 'clientes')} · ${ligacao('mostrar', 'data-vc-mais="contratos"')}</p>` : ''}</section>`;
    const rodape = sv.contratos?.disponivel || f ? '' : rodapeVazio('Os contratos ainda não foram ligados.', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente ficam guardados aqui. Nada se perde até lá.');
    const pe = `<p class="v2c-sub v2k-nota">${esc(f ? 'Os contratos que estão no Vybe Finanças vêm de lá (início, fim, assinatura, vencimento e PDF) e se alteram no Finanças. Os outros clientes seguem com o registro do Vybe OS, que só quem administra altera.'
      : 'Só o registro do contrato, sem assinatura eletrônica; valor e contrato só quem administra altera. A trilha mostra quanto falta para renovar.')}</p>`;
    return { topo, corpo: `${ajudaHtml}${registrar}${fala}${numeros}${filtros}
      <div class="v2k-grade2 v2k-contratos"><div class="v2k-col-esq">${pedeAcao}${mesAMes}</div>${clientes}</div>${f ? `<div class="v2c-card v2k-fin">${finContratosHtml(f)}</div>` : ''}${rodape}${pe}` };
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
    return `<div class="v2c" data-tela="${estado.aba}"><div class="v2c-topo"><h2 id="vc-titulo">${esc(TITULO_DA_ABA[estado.aba])}</h2>${t.topo || ''}${FECHAR}</div>${abas}
      <p class="vc-aviso" role="status" aria-live="polite">${esc(estado.aviso)}</p>
      <div class="vc-corpo v2c-corpo" id="vc-corpo" role="tabpanel">${erro}${t.corpo}</div></div>`;
  }
  function htmlJanela() {
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
      'data-vc-busca', 'data-vc-filtro-ct', 'data-vc-filtro-ch', 'data-vc-serie-ct', 'data-vc-vista-ch', 'data-vc-hist-ch', 'data-vc-registrar'].find((a) => foco.hasAttribute(a)) : null;
    const valor = chave ? foco.getAttribute(chave) : null, item = foco?.dataset?.vcCli;
    j.innerHTML = htmlJanela();
    if (chave === 'data-vc-busca-onb' || chave === 'data-vc-busca') { const campo = j.querySelector(`[${chave}]`); campo?.focus?.(); campo?.setSelectionRange?.(campo.value.length, campo.value.length); }
    const novoCorpo = j.querySelector('.vc-corpo');
    if (novoCorpo) novoCorpo.scrollTop = rolagem;
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
    if ('vcAjuda' in d) { estado.ajuda = !estado.ajuda; return pintar(); }
    if (d.vcAba) { estado.aba = d.vcAba; estado.form = null; estado.aviso = ''; return pintar(); }
    if (d.vcTipo) { estado.tipo = d.vcTipo; return pintar(); }
    if (d.vcMesIr) { if (/^\d{4}-\d{2}$/.test(d.vcMesIr)) estado.mes = d.vcMesIr; return pintar(); }
    if ('vcFalta' in d) { estado.verFalta = !estado.verFalta; return pintar(); }
    if (d.vcRisco) { estado.risco = d.vcRisco; if ('vcLimpar' in d) estado.head = 'todos'; delete estado.limite.saude; return pintar(); }
    if (d.vcMais) { estado.limite[d.vcMais] = (estado.limite[d.vcMais] || PAGINA) + PAGINA; return pintar(); }
    if (d.vcAbrir) return alternarLinha(d.vcAbrir, d.vcFocar || '');
    if (d.vcVisao) { estado.visao = d.vcVisao; return pintar(); }
    if ('vcFiltros' in d) { estado.filtros = !estado.filtros; return pintar(); }
    if (d.vcHeadFicha) { estado.head = estado.head === d.vcHeadFicha ? 'todos' : d.vcHeadFicha; delete estado.limite.saude; return pintar(); }
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
    if (d.vcKickoff) return window.abrirReuniao?.(d.vcKickoff, '', { tipo: 'onboarding', titulo: `Kickoff - ${d.vcKickoff}` });
    if (d.vcQuest) return d.vcQuest === 'junto' ? window.abrirQuestionario?.(d.vcCli, d.vcNome || '') : window.onboardingLink?.(d.vcCli);
    if (d.vcOnb) return gravar({ acao: d.vcOnb, cliente_id: d.vcCli }, d.vcOnb === 'onboarding_encerrar' ? 'Onboarding encerrado.' : 'Onboarding reaberto.');
    if ('vcEncerrados' in d) { estado.verEncerrados = !estado.verEncerrados; return pintar(); }
    if (d.vcFormAbrir) {
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
    linha.querySelector('.v2c-abrir')?.setAttribute('aria-expanded', String(abrindo));
    if (focar) { linha.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' }); (focar === 'resp' ? [...linha.querySelectorAll('select[data-vc-resp]')].find((x) => !x.value && !x.disabled) : linha.querySelector('.v2c-abrir'))?.focus?.({ preventScroll: true }); }
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
    return r ? r.clientes.map((c) => ({ cliente: c.nome, clienteId: c.id, score: c.score, risco: c.risco,
      motivos: c.motivos.filter((m) => m.tom === 'ruim').map((m) => m.texto), head: c.heads.join(', ') })) : [];
  }

  window.addEventListener('keydown', aoTeclar, true);
  window.VybeCarteira = Object.freeze({ abrir, fechar, aberto, dados });
})();
