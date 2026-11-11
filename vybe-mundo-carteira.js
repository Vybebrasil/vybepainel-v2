// vybe-mundo-carteira.js — o módulo Carteira do Irecity (Paulo, 07/11/2026, inspirado no AgencyFlow).
//
// Uma janela do padrão claro (docs/padrao-visual.md) por cima do mapa, com quatro abas:
//  - Saúde: a nota 0–100 e o risco de churn de cada cliente ativo (vybe-carteira-saude.js), do menor
//    para o maior ("prioritários"), com os motivos em frases curtas, a média por head e a média da
//    carteira mês a mês.
//  - Onboarding: a esteira de cada cliente novo (etapas configuráveis), com checklist, responsável por
//    etapa e "parada desde".
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
    saude: null, aviso: '', ajuda: false, ordem: { saude: 'risco', churn: 'recente', contratos: 'renovacao' }, risco: 'todos', head: 'todos',
    limite: {}, abertos: new Set(), form: null, editorEtapas: null, salvando: false, verEncerrados: false, verFalta: false, rotulo: '',
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
  function linhaCliente(c, casa = null) {
    const aberto = estado.abertos.has(`c:${c.nome}`);
    const tempo = c.id && casa ? casa.get(c.id) : null;
    const ruins = c.motivos.filter((m) => m.tom === 'ruim');
    const resumo = ruins.length ? ruins.slice(0, 2).map((m) => m.texto).join(' · ') : (c.motivos[0]?.texto || 'sem sinal de alerta');
    return `<li class="vc-linha ${c.nivel}">
      <button type="button" class="vc-linha-topo" data-vc-abrir="c:${esc(c.nome)}" aria-expanded="${aberto}">
        <span class="vc-nota-num ${c.nivel}" aria-label="Nota ${c.score}">${c.score}</span>
        <span class="vc-meio"><b>${cliCor(c.nome)}</b><small>${esc(resumo)}</small></span>
        ${etiqueta(c.rotuloRisco, c.nivel)}
      </button>
      ${aberto ? `<div class="vc-detalhe">
        <ul class="vc-motivos">${c.motivos.map((m) => `<li class="${m.tom}"><span>${esc(m.texto)}</span>${m.pontos ? `<b>${m.pontos}</b>` : ''}</li>`).join('')}</ul>
        <p class="vc-nota">Head: ${esc(c.heads.join(', ') || 'sem head')}${c.carteira ? ` · Carteira: ${esc(c.carteira)}` : ''}</p>
        ${tempo ? `<p class="vc-nota">${esc(casaTxt(tempo))}${tempo.temContrato ? ` · ${esc(contratoTxt(tempo))}` : ' · sem contrato registrado'}</p>` : ''}
        ${secundario('Abrir o cliente', `data-vc-cliente="${esc(c.nome)}"`)}
      </div>` : ''}</li>`;
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
  function abaSaude() {
    const r = estado.saude;
    if (!S() || !window.VybeDono) return vazio('A conta da saúde não carregou nesta página.', acao('Atualizar a página', 'data-vc-atualizar'));
    if (!r || !r.clientes.length) return vazio(cadastro().length ? 'Nenhum cliente ativo com peças no painel ainda.' : 'O cadastro de clientes ainda não carregou.', acao('Carregar de novo', 'data-vc-recarregar'));
    espiarCarteira.saude = r;
    const h = S().historicoSaude({ meses: estado.servidor?.historico?.meses || [], atual: r.resumo, hoje: r.dia });
    const heads = [...new Set(r.clientes.flatMap((c) => (c.heads.length ? c.heads : [S().SEM_HEAD])))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    let lista = r.clientes.filter((c) => (estado.risco === 'todos' || c.risco === estado.risco)
      && (estado.head === 'todos' || (c.heads.length ? c.heads : [S().SEM_HEAD]).includes(estado.head)));
    if (estado.ordem.saude === 'melhor') lista = [...lista].reverse();
    else if (estado.ordem.saude === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Tempo de casa de cada cliente (para a ficha) e as contas por head com a receita (base do servidor).
    const ctr = contratosAgora();
    if (ctr) espiarCarteira.contratos = ctr;
    const casa = ctr ? new Map(ctr.linhas.map((l) => [l.id, l])) : null;
    const contas = S().contasPorHead({ clientes: r.clientes, base: estado.servidor?.clientes || [], contratos: listaContratos() });
    espiarCarteira.heads = contas;
    const fonte = r.fonte.sinais === 'servidor' ? 'Alteração e aprovação pelo histórico de status (30 e 60 dias).' : 'Alteração e aprovação pelo que está na tela agora (o histórico do servidor não respondeu).';
    // Terceira rodada (quadro 00 Main): os quatro cartões viram a linha de números do padrão; "0 em risco alto" é texto
    // discreto, não um cartão com um zero grande. Cada risco continua abrindo quem está nele (o mesmo data-espiar).
    const mesAntes = { contra: 'vs mês anterior' }, tomDaMedia = { alto: 'alerta', medio: 'atencao', baixo: 'ok' }[S().riscoDaNota(r.resumo.media ?? 0)] || '';
    return `${resumo([
        numero(r.resumo.media, String(r.resumo.media), ' de média da carteira', { ...mesAntes, v: h.variacao.media, tom: tomDaMedia, semDado: 'média da carteira: sem nota ainda' }),
        numero(r.resumo.alto, String(r.resumo.alto), ' em risco alto', { ...mesAntes, v: h.variacao.alto, tom: r.resumo.alto ? 'alerta' : '', espiar: 'risco:alto' }),
        numero(r.resumo.medio, String(r.resumo.medio), ' em risco médio', { tom: r.resumo.medio ? 'atencao' : '', espiar: 'risco:medio' }),
        numero(r.resumo.baixo, String(r.resumo.baixo), ' em risco baixo', { tom: r.resumo.baixo ? 'ok' : '', espiar: 'risco:baixo' }),
      ])}
      <section class="vc-secao"><h3>Média da carteira mês a mês</h3>${serieHtml(h)}</section>
      <section class="vc-secao"><div class="vc-secao-topo"><h3>Clientes prioritários</h3><span class="vc-conta">${lista.length}</span></div>
        <div class="vc-filtros">
          <div class="vc-chips" role="group" aria-label="Filtrar por risco">${[['todos', 'Todos'], ['alto', 'Alto'], ['medio', 'Médio'], ['baixo', 'Baixo']].map(([k, rot]) =>
            `<button type="button" data-vc-risco="${k}" aria-pressed="${estado.risco === k}">${rot}</button>`).join('')}</div>
          <label class="vc-ordem"><span>Head</span><select data-vc-head><option value="todos">Todos</option>${heads.map((x) => `<option${estado.head === x ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
          ${ordemHtml('saude', [['risco', 'Alto risco → baixo'], ['melhor', 'Baixo risco → alto'], ['nome', 'Nome A–Z']])}
        </div>
        ${lista.length ? `<ol class="vc-lista">${cortar(lista, 'saude').map((c) => linhaCliente(c, casa)).join('')}</ol>${verMais('saude', lista.length)}` : vazio('Nenhum cliente neste filtro.', secundario('Ver todos', 'data-vc-risco="todos" data-vc-limpar'))}
        ${nota(fonte)}
      </section>
      ${contasHtml(contas)}`;
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
  function paradaHtml(atual) {
    if (!atual?.parada_desde) return '';
    const d = atual.dias_parada ?? 0, nivel = d >= 14 ? 'u1' : d >= 7 ? 'u2' : 'u5';
    return etiqueta(`${atual.nome} parada desde ${dataCurta(diaDoCarimbo(atual.parada_desde))}${d ? ` · ${plural(d, 'dia', 'dias')}` : ''}`, nivel);
  }
  function cartaoOnboarding(o, etapas) {
    const s = o.situacao, aberto = estado.abertos.has(`o:${o.cliente_id}`), pode = podeOnboarding(o.cliente_id) && !o.encerrado_em;
    const esteira = `<ol class="vc-esteira" aria-label="Etapas">${s.etapas.map((e) => {
      const tom = e.concluida ? 'feita' : s.atual?.id === e.id ? 'atual' : '';
      return `<li class="${tom}"><i aria-hidden="true">${e.concluida ? '✓' : ''}</i><span>${esc(e.nome)}</span><small>${e.feitos}/${e.total}</small></li>`;
    }).join('')}</ol>`;
    const pessoas = estado.servidor?.pessoas || [];
    const detalhe = aberto ? `<div class="vc-detalhe">${etapas.map((e) => {
      const dela = o.etapas?.[e.id] || {}, sit = s.etapas.find((x) => x.id === e.id);
      return `<fieldset class="vc-etapa"><legend>${esc(e.nome)} <small>${sit ? `${sit.feitos}/${sit.total}` : ''}</small></legend>
        <label class="vc-campo"><span>Responsável</span><select data-vc-resp="${esc(o.cliente_id)}" data-vc-etapa="${esc(e.id)}"${pode ? '' : ' disabled'}>
          <option value="">Sem responsável</option>${pessoas.map((p) => `<option value="${esc(p.id)}"${String(dela.responsavel_id) === String(p.id) ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
        <ul class="vc-check">${e.itens.map((i) => { const f = dela.feitos?.[i.id];
          return `<li><label><input type="checkbox" data-vc-item="${esc(i.id)}" data-vc-etapa="${esc(e.id)}" data-vc-cli="${esc(o.cliente_id)}"${f ? ' checked' : ''}${pode ? '' : ' disabled'}>
            <span>${esc(i.texto)}${f ? `<small>${esc(f.por || '')} · ${dataCurta(diaDoCarimbo(f.em))}</small>` : ''}</span></label></li>`; }).join('') || '<li class="vc-nota">Etapa sem itens.</li>'}</ul></fieldset>`;
    }).join('')}
      <div class="vc-linha-acoes">${podeOnboarding(o.cliente_id) ? (o.encerrado_em ? secundario('Reabrir', `data-vc-onb="onboarding_reabrir" data-vc-cli="${esc(o.cliente_id)}"`)
        : secundario('Encerrar onboarding', `data-vc-onb="onboarding_encerrar" data-vc-cli="${esc(o.cliente_id)}"`)) : nota('Só quem administra, o Atendimento e os heads do cliente mexem aqui.')}</div></div>` : '';
    const resp = s.atual?.responsavel_id ? nomeDaPessoa(s.atual.responsavel_id) : '';
    // Reunião e questionário (vybe-clientes-reunioes.js): o kickoff grava o áudio; o questionário serve para preencher junto
    // na reunião ou para mandar o link ao cliente.
    const atalhos = pode && typeof window.abrirReuniao === 'function' ? `<div class="vc-linha-acoes vc-onb-atalhos">
        ${acao('Reunião de kickoff', `data-vc-kickoff="${esc(o.cliente || '')}"`)}
        ${secundario('Questionário com o cliente', `data-vc-quest="junto" data-vc-cli="${esc(o.cliente_id)}" data-vc-nome="${esc(o.cliente || '')}"`)}
        ${secundario('Link do questionário', `data-vc-quest="link" data-vc-cli="${esc(o.cliente_id)}"`)}
        ${secundario('Ficha', `data-vc-cliente="${esc(o.cliente || '')}"`)}</div>` : '';
    return `<li class="vc-onb${o.encerrado_em ? ' encerrado' : ''}">
      <button type="button" class="vc-linha-topo" data-vc-abrir="o:${esc(o.cliente_id)}" aria-expanded="${aberto}">
        <span class="vc-pct" style="--p:${s.pct}"><b>${s.pct}%</b></span>
        <span class="vc-meio"><b>${cliCor(o.cliente || '')}</b><small>${o.encerrado_em ? `Encerrado em ${dataCurta(diaDoCarimbo(o.encerrado_em))}` : s.concluido ? 'Todas as etapas feitas' : `${esc(s.atual?.nome || '')}${resp ? ` · com ${esc(resp)}` : ' · sem responsável'}`}</small></span>
        ${o.encerrado_em ? etiqueta('Encerrado', 'u5') : s.concluido ? etiqueta('Pronto', 'u6') : paradaHtml(s.atual)}
      </button>${esteira}${atalhos}${detalhe}</li>`;
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
  function abaOnboarding() {
    const sv = estado.servidor;
    if (!sv) return estado.erro ? vazio(estado.erro, secundario('Tentar de novo', 'data-vc-recarregar')) : '';
    const etapas = sv.etapas || [];
    if (!sv.onboarding?.disponivel) {
      // Redesign (quadros 18 e 56): "Como vai ser a esteira" mostra a esteira, numerada, com os itens de cada etapa.
      const passos = (etapas.length ? etapas : sv.etapas_padrao || []).map((e) => [e.nome, plural(e.itens?.length || 0, 'item', 'itens'), (e.itens || []).map((i) => i.texto).join(' · ')]);
      const lista = passos.length ? passos : [['Cadastro', 'dados, contrato e acessos', ''], ['Questionário e kickoff', 'o cliente responde, o head conduz', ''], ['Checklist', 'Drive, grupo, primeiro planejamento', '']];
      return aguardando('O onboarding ainda não foi ligado', 'Quando estiver ligado, cada cliente novo ou contrato novo ganha aqui a esteira de entrada, com checklist e responsável por etapa.')
        + `<section class="vc-secao"><h3>Como vai ser a esteira</h3><ol class="vc-esteira vc-esteira-previa" aria-label="Etapas do onboarding">${lista.map(([nome, sub, itens], i) =>
          `<li${itens ? ` title="${esc(itens)}"` : ''}><i aria-hidden="true">${i + 1}</i><span>${esc(nome)}</span><small>${esc(sub)}</small></li>`).join('')}</ol>
          ${nota('Cada etapa tem o checklist e o responsável dela; "parada desde" mostra há quanto tempo a etapa atual não anda.')}</section>`;
    }
    if (estado.editorEtapas) return editorEtapasHtml();
    const lista = sv.onboarding.clientes || [];
    const emAberto = lista.filter((o) => !o.encerrado_em), encerrados = lista.filter((o) => o.encerrado_em);
    const ocupados = new Set(emAberto.map((o) => o.cliente_id));
    const candidatos = (sv.clientes || []).filter((c) => c.ativo && !ocupados.has(c.id) && podeOnboarding(c.id)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    // Onboarding começa por um fato novo (Paulo, 09/11/2026: "qual sentido de eu fazer onboard com quem já é cliente?"):
    // cliente novo (cadastro → esteira) ou contrato novo de um cliente da casa (renovação, serviço novo: esteira do zero).
    const podeNovo = typeof window.abrirCadastroCompleto === 'function' && (typeof podeEditarClientes !== 'function' || podeEditarClientes());
    const contrato = estado.contratoNovo ? `<div class="vc-iniciar"><label class="vc-campo"><span>Cliente que fechou contrato novo</span><select data-vc-novo-onb>${candidatos.map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>
      ${secundario('Cancelar', 'data-vc-contrato-novo')}${acao('Começar a esteira', 'data-vc-iniciar')}</div>` : '';
    const iniciar = `<section class="vc-secao vc-onb-comecar" aria-label="Começar um onboarding">
      <div class="vc-onb-caminhos">
        ${podeNovo ? `<button type="button" class="vc-onb-caminho" data-vc-onb-novo><b>Cliente novo</b><small>Cadastra o cliente e já abre a esteira, o questionário e o kickoff.</small></button>` : ''}
        ${candidatos.length ? `<button type="button" class="vc-onb-caminho" data-vc-contrato-novo aria-expanded="${Boolean(estado.contratoNovo)}"><b>Contrato novo</b><small>Cliente da casa que renovou ou fechou um serviço novo: a esteira começa do zero.</small></button>` : ''}
      </div>${contrato}</section>`;
    const ordenados = [...emAberto].sort((a, b) => (b.situacao.atual?.dias_parada ?? -1) - (a.situacao.atual?.dias_parada ?? -1));
    return `${iniciar}
      ${sv.pode?.etapas ? `<div class="vc-linha-acoes">${secundario('Configurar etapas', 'data-vc-ed-abrir')}</div>` : ''}
      <section class="vc-secao"><div class="vc-secao-topo"><h3>Em onboarding</h3><span class="vc-conta">${emAberto.length}</span></div>
      ${ordenados.length ? `<ol class="vc-lista">${cortar(ordenados, 'onboarding').map((o) => cartaoOnboarding(o, etapas)).join('')}</ol>${verMais('onboarding', ordenados.length)}`
        : vazio('Nenhum cliente em onboarding agora. Quando entrar um cliente ou um contrato novo, comece por cima.')}
      </section>
      ${encerrados.length ? `<section class="vc-secao"><button type="button" class="vc-link" data-vc-encerrados aria-expanded="${estado.verEncerrados}">${estado.verEncerrados ? 'Esconder' : 'Ver'} encerrados (${encerrados.length})</button>
        ${estado.verEncerrados ? `<ol class="vc-lista">${encerrados.map((o) => cartaoOnboarding(o, etapas)).join('')}</ol>` : ''}</section>` : ''}`;
  }

  // ---------- Churn ----------
  function formChurn(s) {
    const f = estado.form;
    if (!f || f.tipo !== 'churn' || f.id !== s.id) return '';
    return `<form class="vc-form" data-vc-form="churn" data-vc-cli="${esc(s.id)}">
      <label class="vc-campo"><span>Saiu em</span><input type="date" name="saiu_em" required value="${esc(s.saida)}" max="${esc(hoje())}"></label>
      <label class="vc-campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS()).map(([k, r]) => `<option value="${k}"${s.tipo === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="vc-campo"><span>Motivo</span><select name="motivo">${Object.entries(MOTIVOS()).map(([k, r]) => `<option value="${k}"${s.motivo === k ? ' selected' : ''}>${esc(r)}</option>`).join('')}</select></label>
      <label class="vc-campo"><span>Receita mensal (R$)</span><input type="number" name="receita_mensal" min="0" step="0.01" inputmode="decimal" value="${s.receita ?? ''}"></label>
      <label class="vc-campo largo"><span>O que aconteceu (obrigatório em "Outro")</span><textarea name="detalhe" maxlength="1000" rows="2">${esc(s.detalhe || s.motivoLivre || '')}</textarea></label>
      <div class="vc-linha-acoes"><span class="vc-espaco"></span>${secundario('Cancelar', 'data-vc-form-cancelar')}<button type="submit" class="vc-acao">Salvar motivo</button></div></form>`;
  }
  function linhaSaida(s) {
    const motivo = s.motivo ? etiqueta(MOTIVOS()[s.motivo] || s.motivo, 'u3a') : etiqueta('Sem motivo', 'u5');
    // Saída sem registro nem desativação datada: o servidor estima pela última peça (saida_fonte 'ultima_peca', PR #544).
    const apoio = [`saiu em ${dataCurta(s.saida)}${s.saidaFonte === 'ultima_peca' ? ' (estimada pela última peça)' : ''}`, s.tipo ? TIPOS()[s.tipo] : '', s.meses != null ? `${String(s.meses).replace('.', ',')} meses de casa` : '', s.receita != null ? `${reais(s.receita)}/mês` : ''].filter(Boolean).join(' · ');
    const pode = estado.servidor?.pode?.churn && estado.servidor?.churn?.disponivel;
    return `<li class="vc-linha"><div class="vc-linha-topo estatico"><span class="vc-meio"><b>${cliCor(s.nome)}</b><small>${esc(apoio)}</small>
        ${s.detalhe || s.motivoLivre ? `<small class="vc-citacao">${esc(s.detalhe || s.motivoLivre)}</small>` : ''}</span>${motivo}</div>
      ${pode && !(estado.form?.tipo === 'churn' && estado.form.id === s.id) ? `<div class="vc-linha-acoes">${secundario(s.classificado ? 'Editar motivo' : 'Classificar', `data-vc-form-abrir="churn" data-vc-cli="${esc(s.id)}"`)}</div>` : ''}
      ${formChurn(s)}</li>`;
  }
  // O vazio do padrão (vbEstadoHtml); sem a peça na página, a caixa simples de sempre.
  const estadoVazio = (titulo, texto = '', botao = '') => (typeof vbEstadoHtml === 'function' ? vbEstadoHtml({ titulo, texto, acao: botao }) : vazio([titulo, texto].filter(Boolean).join('. '), botao));
  function cohortHtml(c) {
    if (!c.linhas.length) return estadoVazio('Ainda sem data de entrada dos clientes', 'A retenção por mês de entrada aparece quando houver início de contrato ou data de cadastro.', estado.servidor?.pode?.contratos ? secundario('Registrar início nos contratos', 'data-vc-aba="contratos"') : '');
    const cor = (p) => (p == null ? '' : p >= 90 ? 'u6' : p >= 70 ? 'u4' : p >= 50 ? 'u2' : 'u3a');
    return `<div class="vc-tabela-rola"><table class="vc-cohort"><thead><tr><th scope="col">Entrada</th><th scope="col">Clientes</th>${c.colunas.map((n) => `<th scope="col">${n}º mês</th>`).join('')}</tr></thead>
      <tbody>${c.linhas.map((l) => `<tr><th scope="row">${esc(l.mes.slice(5, 7))}/${esc(l.mes.slice(2, 4))}</th><td>${l.entraram}</td>${l.colunas.map((x) => `<td class="${cor(x.pct)}" title="${x.pct == null ? 'ainda não chegou' : `${x.ficaram} de ${l.entraram}`}">${x.pct == null ? '' : `${x.pct}%`}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${c.semEntrada ? nota(`${plural(c.semEntrada, 'cliente sem data de entrada fica', 'clientes sem data de entrada ficam')} de fora (a entrada é o início do contrato; sem ele, a data do cadastro).`) : ''}`;
  }
  function abaChurn() {
    const sv = estado.servidor;
    if (sv?.aguardando) return aguardando('O churn ainda não foi ligado', 'Quando estiver ligado, quem saiu, por quê e a receita perdida aparecem aqui.');
    if (!sv?.clientes) return vazio(estado.erro || 'A base de clientes não carregou.', secundario('Tentar de novo', 'data-vc-recarregar'));
    const r = S().churn({ clientes: sv.clientes, registros: sv.churn?.registros || [], contratos: listaContratos(), tipo: estado.tipo, mes: estado.mes });
    const c = S().cohort({ clientes: sv.clientes, hoje: hoje() });
    let lista = r.lista;
    if (estado.ordem.churn === 'receita') lista = [...lista].sort((a, b) => (b.receita ?? -1) - (a.receita ?? -1));
    else if (estado.ordem.churn === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const max = Math.max(1, ...r.porMotivo.map((m) => m.vezes));
    const um = (x) => String(x).replace('.', ',');
    // Terceira rodada (quadro 18, o mesmo tratamento dos Contratos): sem nenhuma saída, nenhuma entrada com data e sem
    // retenção para montar, um estado vazio só no lugar de três caixas de "nenhum"; a conta fica no ⓘ do título.
    const temSaida = churnTemSaida(), serie = serieDosMeses();
    const semNada = !temSaida && !c.linhas.length && !(serie && serie.meses.some((p) => Number(p.saidas) > 0 || Number(p.novos) > 0));
    const corpo = semNada ? `<section class="vc-secao"><h3>Saídas e retenção ${dicaHtml(COMO_CONTA_CHURN)}</h3>${estadoVazio('Nenhum cliente saiu até agora', 'Quem sair aparece aqui com o tipo, o motivo e a receita perdida. As saídas por mês e a retenção por mês de entrada aparecem quando houver cliente com data de entrada ou de saída.')}</section>`
      : `<section class="vc-secao"><div class="vc-secao-topo"><h3>Quem saiu em ${esc(r.periodo.rotulo)}</h3><span class="vc-conta">${r.saidas}</span></div>
        ${lista.length ? `<div class="vc-filtros">${ordemHtml('churn', [['recente', 'Mais recente → antiga'], ['receita', 'Maior receita → menor'], ['nome', 'Nome A–Z']])}</div>
          <ol class="vc-lista">${cortar(lista, 'churn').map(linhaSaida).join('')}</ol>${verMais('churn', lista.length)}`
          : estadoVazio(`Nenhum cliente saiu em ${r.periodo.rotulo}`, '', estado.tipo === 'mensal' && temSaida ? secundario('Ver o ano inteiro', 'data-vc-tipo="anual"') : '')}
      </section>
      ${saidasPorMesHtml()}
      <section class="vc-secao"><h3>Retenção por mês de entrada</h3>${cohortHtml(c)}</section>`;
    return `${sv.churn?.disponivel ? '' : aguardando('A classificação das saídas ainda não foi ligada', 'As saídas já aparecem pela desativação do cliente; o motivo de cada uma passa a ser guardado quando estiver ligada.')}
      ${resumo([
        numero(r.taxa, `${um(r.taxa)}%`, ' de churn', { v: r.variacao.taxa, formato: (x) => `${um(x)} p.p.`, tom: r.taxa ? 'atencao' : '', semDado: 'taxa de churn: sem base no período' }),
        numero(r.saidas, String(r.saidas), r.saidas === 1 ? ' saída' : ' saídas', { v: r.variacao.saidas, tom: r.saidas ? 'alerta' : '' }),
        numero(r.receitaPerdida, reais(r.receitaPerdida), ' de receita perdida por mês', { v: r.variacao.receitaPerdida, formato: reais, semDado: 'receita perdida: sem valor' }),
        numero(r.tempoMedioMeses, `${um(r.tempoMedioMeses)} meses`, ' de casa até sair, em média', { v: r.variacao.tempoMedioMeses, formato: (x) => `${um(x)} meses`, semDado: 'tempo até sair: sem saída no período' }),
      ])}
      ${r.saidas ? `<p class="vc-destaque">Principal motivo em ${esc(r.periodo.rotulo)}: <b>${esc(r.principalMotivo ? `${r.principalMotivo.rotulo} (${r.principalMotivo.vezes})` : 'ainda sem classificação')}</b>${r.semClassificar ? ` · ${plural(r.semClassificar, 'saída sem motivo', 'saídas sem motivo')}` : ''}${r.semReceita ? ` · ${plural(r.semReceita, 'sem valor', 'sem valor')} na receita` : ''}</p>
      <div class="vc-motivos-barras">${r.porMotivo.map((m) => `<div><span>${esc(m.rotulo)}</span><i style="width:${(m.vezes / max) * 100}%"></i><b>${m.vezes}</b></div>`).join('')}</div>` : ''}
      ${corpo}`;
  }
  // Como o churn é contado: vai para o ⓘ do título (terceira rodada, quadro 18: o parágrafo técnico sai do rodapé).
  const COMO_CONTA_CHURN = 'Saída = desativação no cadastro (a data do registro de churn, quando houver). Entrada = início do contrato; sem ele, a data do cadastro.';
  const churnTemSaida = () => (estado.servidor?.clientes || []).some((c) => c && c.id != null && c.saida);
  // Mensal/Anual só muda a conta quando existe alguma saída; o mês anda a janela dos gráficos, que pede entrada ou saída com data.
  const churnTemHistorico = () => churnTemSaida() || (estado.servidor?.clientes || []).some((c) => c && c.id != null && c.entrada);
  function guardarBase() {
    espiarCarteira.base = estado.servidor?.clientes || [];
    espiarCarteira.listaContratos = listaContratos();
  }
  function saidasPorMesHtml() {
    const s = serieDosMeses();
    if (!s) return '';
    guardarBase();
    // Nenhuma saída nem entrada nos meses da janela: uma frase, não dois gráficos vazios.
    if (!s.meses.some((p) => Number(p.saidas) > 0 || Number(p.novos) > 0)) return `<section class="vc-secao"><h3>Saídas por mês ${dicaHtml(COMO_CONTA_CHURN)}</h3>${estadoVazio('Ninguém saiu nem entrou nestes meses', 'As barras de quem saiu e de quem entrou em cada mês aparecem quando houver cliente com data de entrada ou de saída no período.')}</section>`;
    return `<section class="vc-secao"><h3>Saídas por mês ${dicaHtml(`${COMO_CONTA_CHURN} Toque numa barra para ver quem.`)}</h3><div class="vc-grafs">
      ${barrasMes(s.meses, 'saidas', { titulo: 'Clientes que saíram', cor: '#D93D42', fraca: '#F2C4C6', formato: String, espiar: (p) => `mes:saidas:${p.mes}`, zero: 'Ninguém saiu nestes meses.' })}
      ${barrasMes(s.meses, 'novos', { titulo: 'Clientes que entraram', cor: '#18A957', fraca: '#BFE6CF', formato: String, espiar: (p) => `mes:novos:${p.mes}`, zero: 'Ninguém entrou nestes meses.' })}</div></section>`;
  }

  // ---------- Contratos ----------
  // Como o mês a mês é contado: vai para o ⓘ do título (redesign, quadro 18: o parágrafo técnico sai do rodapé).
  function comoContaMesAMes(s) {
    return `Cada mês na data do último dia (o mês corrente, hoje). Ativos = entraram até ali e não tinham saído${s?.semEntrada ? ` (${plural(s.semEntrada, 'cliente sem data de entrada conta', 'clientes sem data de entrada contam')} como antigo)` : ''}. Ticket = receita mensal ativa ÷ clientes ativos com valor. As saídas por mês ficam na aba Churn.`;
  }
  const CAMPOS_MES_A_MES = ['ativos', 'novos', 'ltvMedio', 'ticketMedio'];
  const mesAMesTemDado = (s) => Boolean(s && s.meses.some((p) => CAMPOS_MES_A_MES.some((c) => Number(p[c]) > 0)));
  function mesAMesHtml() {
    const s = serieDosMeses();
    if (!s) return '';
    guardarBase();
    // Redesign (quadro 18): sem nenhum valor, nada de quatro gráficos só de zero; uma linha diz quando aparecem.
    // A explicação de como se conta fica no ⓘ do título nos dois casos (com e sem dado), para todo mundo.
    const semDado = 'Os gráficos de ativos, novos, LTV e ticket aparecem quando houver cliente ativo com data de entrada.';
    if (!mesAMesTemDado(s)) return `<section class="vc-secao"><h3>Mês a mês ${dicaHtml(comoContaMesAMes(s))}</h3>${typeof vbEstadoHtml === 'function' ? vbEstadoHtml({ titulo: 'Ainda sem histórico para mostrar', texto: semDado }) : nota(semDado)}</section>`;
    return `<section class="vc-secao"><h3>Mês a mês ${dicaHtml(comoContaMesAMes(s))}</h3><div class="vc-grafs">
      ${barrasMes(s.meses, 'ativos', { titulo: 'Clientes ativos', formato: String })}
      ${barrasMes(s.meses, 'novos', { titulo: 'Clientes novos', cor: '#18A957', fraca: '#BFE6CF', formato: String, espiar: (p) => `mes:novos:${p.mes}`, zero: 'Ninguém entrou nestes meses.' })}
      ${barrasMes(s.meses, 'ltvMedio', { titulo: 'LTV médio (meses)' })}
      ${barrasMes(s.meses, 'ticketMedio', { titulo: 'Ticket médio (R$)', formato: milTxt })}</div></section>`;
  }
  // Redesign (quadro 18): Mensal/Anual e o mês só onde mudam algo. Nos Contratos sem nenhum cliente ativo, nada muda.
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
  function linhaContrato(l) {
    const [rot, niv] = STATUS_CONTRATO[l.status] || ['Sem contrato', 'u5'];
    const ren = l.renovacao ? (l.vencida ? etiqueta(`Renovação vencida em ${dataCurta(l.renovacao)}`, 'u1') : l.emBreve ? etiqueta(l.diasRenovacao ? `Renova em ${plural(l.diasRenovacao, 'dia', 'dias')}` : 'Renova hoje', 'u2') : etiqueta(rot, niv)) : etiqueta(rot, niv);
    const apoio = [l.valor != null ? `${reais(l.valor)}/mês${l.valorDoCadastro ? ' (do cadastro)' : ''}` : 'sem valor', l.inicio ? `desde ${dataCurta(l.inicio)}` : '', l.renovacao ? `renova ${dataCurta(l.renovacao)}` : ''].filter(Boolean).join(' · ');
    const casa = [casaTxt(l), l.receitaLtv != null ? `LTV estimado ${reais(l.receitaLtv)}` : '', l.temContrato ? contratoTxt(l) : ''].filter(Boolean).join(' · ');
    // Contrato do Vybe Finanças: os dados vêm de lá (só leitura); editar é no Finanças.
    const fc = window.VybeFinancas?.contratoDoCliente?.(l.id) || null;
    const daFin = fc ? `<small class="vc-casa">${esc(['Vybe Finanças: ' + fc.titulo, fc.assinado_em ? 'assinado em ' + dataCurta(fc.assinado_em) : 'sem data de assinatura', fc.dia_vencimento ? 'vence dia ' + fc.dia_vencimento : '', fc.status, fc.tem_pdf ? 'com PDF' : 'sem PDF'].filter(Boolean).join(' · '))}</small>` : '';
    const pode = !fc && estado.servidor?.pode?.contratos && estado.servidor?.contratos?.disponivel;
    return `<li class="vc-linha${l.vencida ? ' u1' : l.emBreve ? ' u2' : ''}"><div class="vc-linha-topo estatico"><span class="vc-meio"><b>${cliCor(l.nome)}</b><small>${esc(apoio)}</small><small class="vc-casa">${esc(casa)}</small>${daFin}${l.observacao ? `<small class="vc-citacao">${esc(l.observacao)}</small>` : ''}</span>${ren}</div>
      ${pode && !(estado.form?.tipo === 'contrato' && estado.form.id === l.id) ? `<div class="vc-linha-acoes">${secundario(l.temContrato ? 'Editar' : 'Registrar contrato', `data-vc-form-abrir="contrato" data-vc-cli="${esc(l.id)}"`)}</div>` : ''}
      ${formContrato(l)}</li>`;
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
  function abaContratos() {
    const sv = estado.servidor;
    if (sv?.aguardando) return aguardando('Os contratos ainda não foram ligados', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente aparecem aqui. Nada se perde até lá.');
    if (!sv?.clientes) return vazio(estado.erro || 'A base de clientes não carregou.', secundario('Tentar de novo', 'data-vc-recarregar'));
    const r = S().contratos({ clientes: sv.clientes, contratos: listaContratos(), hoje: hoje(), tipo: estado.tipo, mes: estado.mes });
    espiarCarteira.contratos = r;
    let lista = r.linhas;
    if (estado.ordem.contratos === 'valor') lista = [...lista].sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
    else if (estado.ordem.contratos === 'nome') lista = [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const breve = [...r.vencidas, ...r.emBreve];
    const primeiro = r.linhas.find((l) => !l.temContrato);
    const f = finCarteira();
    // Redesign (quadro 18): os oito números numa linha, o que vence em vermelho; a explicação do LTV vai para o ⓘ.
    const dicaLtv = `LTV = meses desde o início do contrato (sem contrato, a data de entrada no cadastro) até hoje, só clientes ativos. Receita estimada = valor mensal × meses de casa.${r.semDataLtv ? ` ${plural(r.semDataLtv, 'cliente sem data fica', 'clientes sem data ficam')} fora da média.` : ''} Tempo restante = dias até a renovação dos contratos abertos que ainda não venceram${r.restanteMedio ? ` (${plural(r.restanteMedio.contratos, 'contrato', 'contratos')})` : ''}.`;
    return `${sv.contratos?.disponivel || f ? '' : aguardando('Os contratos ainda não foram ligados', 'Quando estiverem ligados, o valor, o início e a renovação de cada cliente ficam guardados aqui. Nada se perde até lá.')}
      ${finContratosHtml(f)}
      ${resumo([
        numero(r.receita, reais(r.receita), ' por mês em contratos ativos', { v: r.variacao.receita, formato: reais }),
        r.vencidas.length ? numero(r.vencidas.length, String(r.vencidas.length), r.vencidas.length === 1 ? ' renovação vencida' : ' renovações vencidas', { tom: 'alerta', espiar: 'contratos:breve' }) : null,
        numero(r.emBreve.length, String(r.emBreve.length), r.emBreve.length === 1 ? ' renova em 30 dias' : ' renovam em 30 dias', { tom: r.emBreve.length ? 'alerta' : '', espiar: 'contratos:breve' }),
        numero(r.semContrato, String(r.semContrato), ' sem contrato', { tom: r.semContrato ? 'atencao' : '', espiar: 'contratos:sem' }),
        numero(r.ticketMedio, reais(r.ticketMedio), ' de ticket médio', { semDado: 'ticket médio: sem valor' }),
        numero(r.ltvMedio, mesesTxt(r.ltvMedio), ' de casa em média (LTV)', { espiar: 'ltv:meses', dica: dicaLtv, semDado: 'tempo de casa (LTV): sem data de entrada' }),
        numero(r.receitaLtv, reais(r.receitaLtv), ' de receita estimada do LTV', { espiar: 'ltv:receita', semDado: 'receita do LTV: sem valor' }),
        numero(r.novos.length, String(r.novos.length), `${r.novos.length === 1 ? ' cliente novo' : ' clientes novos'} ${estado.tipo === 'anual' ? 'no ano' : 'no mês'}`, { v: r.variacao.novos, formato: String, tom: r.novos.length ? 'ok' : '', espiar: 'novos:periodo' }),
        numero(r.restanteMedio?.dias ?? null, r.restanteMedio ? restanteTxt(r.restanteMedio.dias).replace('faltam ', '') : '', ' até a renovação, em média', { espiar: 'contratos:restante', semDado: 'tempo até a renovação: sem data marcada' }),
      ])}
      ${breve.length ? `<section class="vc-secao vc-breve"><div class="vc-secao-topo"><h3>Renovações em breve</h3><span class="vc-conta">${breve.length}</span></div><ol class="vc-lista">${breve.map(linhaContrato).join('')}</ol></section>` : ''}
      <section class="vc-secao"><div class="vc-secao-topo"><h3>Todos os clientes ativos</h3><span class="vc-conta">${lista.length}</span></div>
        ${lista.length ? `<div class="vc-filtros">${ordemHtml('contratos', [['renovacao', 'Renovação mais próxima'], ['valor', 'Maior valor → menor'], ['nome', 'Nome A–Z']])}</div>
          <ol class="vc-lista">${cortar(lista, 'contratos').map(linhaContrato).join('')}</ol>${verMais('contratos', lista.length)}`
          : vazio('Nenhum cliente ativo no cadastro. Quem entra no cadastro como ativo aparece aqui.')}
        ${!f && sv.contratos?.disponivel && !(sv.contratos.lista || []).length && primeiro && sv.pode?.contratos ? vazio('Nenhum contrato registrado ainda.', acao('Registrar o primeiro', `data-vc-form-abrir="contrato" data-vc-cli="${esc(primeiro.id)}"`)) : ''}
        ${nota(f ? 'Os contratos que estão no Vybe Finanças vêm de lá (início, fim, assinatura, vencimento e PDF) e se alteram no Finanças. Os outros clientes seguem com o registro do Vybe OS, que só quem administra altera.' : 'Só o registro do contrato: sem assinatura eletrônica. Valor e contrato só quem administra altera.')}
      </section>
      ${mesAMesHtml()}`;
  }

  // ---------- janela ----------
  const AJUDA = `<div class="vc-ajuda" role="note"><b>Como a Carteira funciona</b>
    <p><b>Saúde</b>: cada cliente ativo começa com 100 e perde pontos por peça atrasada, risco de furo, voltas para alteração, aprovação parada, entregas fora do prazo, calendário vazio, contrato vencendo, pagamento atrasado, NPS baixo, muito tempo sem reunião e clima ruim no grupo. Abaixo de 50 é risco alto; de 50 a 74, médio. Toque num cliente para ver os motivos.</p>
    <p><b>Onboarding</b>: começa quando entra um cliente novo (o cadastro abre na hora) ou um contrato novo de um cliente da casa. Cada um tem a esteira com checklist e responsável por etapa, a reunião de kickoff (com gravação) e o questionário. "Parada desde" mostra há quanto tempo a etapa atual não anda.</p>
    <p><b>Churn</b>: quem saiu (pela desativação no cadastro), com tipo e motivo. Taxa = saídas ÷ clientes ativos no começo do período. O cohort mostra quantos de cada mês de entrada seguiam ativos depois de 1, 2, 3, 6 e 12 meses.</p>
    <p><b>Contratos</b>: valor mensal, início, renovação e status. Renovações dos próximos 30 dias ficam em destaque. LTV = há quantos meses o cliente está com a Vybe (do início do contrato; sem ele, da entrada no cadastro); receita estimada = valor mensal × meses. O mês a mês mostra ativos, novos, LTV médio e ticket médio.</p>
    <p><b>Contas por head</b> (na Saúde): quantos clientes cada head tem, a nota média deles e a receita mensal.</p>
    <p>Mensal/Anual e o mês no topo valem para Churn e Contratos.</p></div>`;
  function htmlJanela() {
    const corpo = estado.carregando && !estado.servidor && !estado.saude ? '<p class="vc-carregando" role="status">Lendo a carteira…</p>'
      : ({ saude: abaSaude, onboarding: abaOnboarding, churn: abaChurn, contratos: abaContratos }[estado.aba] || abaSaude)();
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
    const chave = dentro ? ['data-vc-aba', 'data-vc-risco', 'data-vc-tipo', 'data-vc-abrir', 'data-vc-ordem', 'data-vc-item', 'data-vc-resp', 'data-vc-head', 'data-vc-mes-ir', 'data-vc-falta'].find((a) => foco.hasAttribute(a)) : null;
    const valor = chave ? foco.getAttribute(chave) : null, item = foco?.dataset?.vcCli;
    j.innerHTML = htmlJanela();
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
    if (d.vcRisco) { estado.risco = d.vcRisco; if ('vcLimpar' in d) estado.head = 'todos'; estado.limite.saude = PAGINA; return pintar(); }
    if (d.vcMais) { estado.limite[d.vcMais] = (estado.limite[d.vcMais] || PAGINA) + PAGINA; return pintar(); }
    if (d.vcAbrir) { estado.abertos.has(d.vcAbrir) ? estado.abertos.delete(d.vcAbrir) : estado.abertos.add(d.vcAbrir); return pintar(); }
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
    if (d.vcFormAbrir) { estado.form = { tipo: d.vcFormAbrir, id: d.vcCli }; pintar(); estado.janela.querySelector('.vc-form input, .vc-form select')?.focus(); return; }
    if ('vcFormCancelar' in d) { estado.form = null; return pintar(); }
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
