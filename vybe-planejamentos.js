// vybe-planejamentos.js — planejamentos mensais dos clientes (docs/planejamentos-plano.md).
//
// O agente de conteúdo do cliente publica o planejamento do mês; o head revisa,
// edita aqui mesmo e manda para o cliente aprovar por um link (que ele cola no
// WhatsApp; uma cópia vai sempre para o e-mail do cliente). Todos da equipe
// veem; editar e mandar é do head do cliente e de quem administra. O servidor
// confere tudo de novo: os botões aqui só escondem o que não vale.

const PLJ_ESTADOS = {
  revisar: { rotulo: 'Para revisar', cls: 'revisar' },
  enviado: { rotulo: 'Com o cliente', cls: 'enviado' },
  aprovado: { rotulo: 'Aprovado', cls: 'aprovado' },
  ajustes: { rotulo: 'Ajustes pedidos', cls: 'ajustes' },
  cadastrado: { rotulo: 'Cadastrado', cls: 'cadastrado' },
  arquivado: { rotulo: 'Arquivado', cls: 'arquivado' },
};
const PLJ_FORMATOS = ['Card', 'Carrossel', 'Reels', 'Fotografia', 'Vídeo', 'Stories', 'Outro'];
const PLJ_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
let PLJ_ABERTO = null;   // planejamento na janela (detalhe do servidor)
let PLJ_RASCUNHO = null; // conteúdo em edição
let PLJ_PENDENTES = [];
let PLJ_ALERTAS = []; // alertas das peças dos clientes do head (alertas-clientes.js)

const pljEsc = (v) => (typeof safeText === 'function' ? safeText(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`));
const pljMes = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); if (!m) return ''; const n = PLJ_MESES[Number(m[2]) - 1]; return `${n[0].toUpperCase()}${n.slice(1)} de ${m[1]}`; };
const pljQuando = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
const pljSelo = (estado) => { const e = PLJ_ESTADOS[estado] || { rotulo: estado, cls: '' }; return `<span class="plj-selo ${e.cls}">${pljEsc(e.rotulo)}</span>`; };

async function pljPedir(params, corpo) {
  const url = `/api/painel?area=planejamentos${params ? '&' + params : ''}`;
  const r = await fetch(url, corpo ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) }
    : { credentials: 'same-origin', cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || 'Não foi possível falar com o painel.');
  return d;
}

// ── Cartão no detalhe do cliente ─────────────────────────────────────────────
function planejamentosDoClienteHtml() {
  return `<div class="client-master-detail-card plj-cartao" id="plj-cartao">
    <div class="cli-ficha-topo"><h3>Planejamentos</h3></div>
    <div class="plj-lista"><div class="auto-carregando">Buscando os planejamentos…</div></div></div>`;
}
// "raiz": onde está o quadro (a ficha do cliente ou o painel do agente no
// Escritório); sem ela, o da página.
async function carregarPlanejamentosDoCliente(clienteId, nome, raiz = document) {
  const caixa = raiz.querySelector('#plj-cartao .plj-lista');
  if (!caixa) return;
  if (!clienteId) { caixa.innerHTML = '<p class="plj-vazio">Este cliente ainda não tem cadastro no painel.</p>'; return; }
  try {
    const d = await pljPedir(`cliente_id=${encodeURIComponent(clienteId)}`);
    if (!caixa.isConnected) return;
    if (!d.disponivel) { caixa.innerHTML = '<p class="plj-vazio">Os planejamentos ainda não foram ligados no banco.</p>'; return; }
    const lista = d.planejamentos || [];
    const podeCriar = lista.some((p) => p.pode_editar) || (typeof podeEditarClientes === 'function' && podeEditarClientes());
    caixa.innerHTML = `${lista.length ? `<ul class="plj-meses">${lista.map((p) => `<li>
        <button type="button" class="plj-mes" onclick="abrirPlanejamento('${pljEsc(p.id)}')">
          <b>${pljEsc(pljMes(p.mes))}</b><small>${pljEsc(p.titulo)} · versão ${pljEsc(p.versao)}${pljPlacar(p)}</small>${pljSelo(p.estado)}</button></li>`).join('')}</ul>`
      : '<p class="plj-vazio">Nenhum planejamento ainda. Quando o agente do cliente publicar, ele aparece aqui para revisar.</p>'}
      ${podeCriar ? `<button type="button" class="cli-porta" onclick="novoPlanejamento('${pljEsc(clienteId)}', '${pljEsc(String(nome).replace(/'/g, "\\'"))}')">Começar um planejamento aqui</button>` : ''}`;
  } catch (e) {
    caixa.innerHTML = `<p class="plj-vazio">Não foi possível buscar: ${pljEsc(e.message)}</p>`;
  }
}

function novoPlanejamento(clienteId, nome) {
  const hoje = new Date();
  const prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
  const mes = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, '0')}`;
  openWorkflowModal(`<div class="workflow-kicker"><span>Planejamento · ${pljEsc(nome)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Novo planejamento</h2>
    <p class="workflow-copy">Normalmente o agente do cliente publica e você só revisa. Use isto quando for montar o mês à mão.</p>
    <label class="workflow-field"><span>Mês</span><input id="plj-novo-mes" type="month" value="${mes}"></label>
    <label class="workflow-field"><span>Título</span><input id="plj-novo-titulo" type="text" maxlength="160" value="Planejamento de conteúdo"></label>
    <label class="workflow-field"><span>Conteúdo que o agente entregou (opcional)</span>
      <textarea id="plj-novo-json" rows="4" spellcheck="false" placeholder="Cole aqui o JSON do agente, se ele não conseguiu publicar sozinho."></textarea></label>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="criarPlanejamento('${pljEsc(clienteId)}', this)">Criar e editar →</button></div>`);
}
async function criarPlanejamento(clienteId, botao) {
  const bruto = document.getElementById('plj-novo-json')?.value.trim();
  let conteudo = {};
  if (bruto) {
    try { conteudo = JSON.parse(bruto.replace(/^```(?:json)?\s*|\s*```$/g, '')); conteudo = conteudo.conteudo || conteudo; }
    catch { showToast('O conteúdo colado não é um JSON válido. Copie de novo a resposta do agente.', 'error', 6000); return; }
  }
  botao.disabled = true;
  try {
    const d = await pljPedir('', { acao: 'criar', cliente_id: clienteId, mes: document.getElementById('plj-novo-mes')?.value,
      titulo: document.getElementById('plj-novo-titulo')?.value, conteudo });
    await abrirPlanejamento(d.planejamento.id, 'editar');
    pljAtualizarFora();
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 5000); }
}

// ── Janela do planejamento ───────────────────────────────────────────────────
async function abrirPlanejamento(id, aba = 'documento') {
  openWorkflowModal(`<div class="auto-carregando">Abrindo o planejamento…</div>`);
  document.getElementById('workflow-modal')?.classList.add('plj-janela');
  try {
    const d = await pljPedir(`acao=detalhe&id=${encodeURIComponent(id)}`);
    PLJ_ABERTO = d.planejamento;
    PLJ_RASCUNHO = JSON.parse(JSON.stringify(PLJ_ABERTO.conteudo || {}));
    PLJ_SUJO = false;
    pintarPlanejamento(aba);
  } catch (e) {
    const m = document.getElementById('workflow-modal');
    if (m) m.innerHTML = `<div class="workflow-kicker"><span>Planejamento</span><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
      <p class="workflow-copy">Não foi possível abrir: ${pljEsc(e.message)}</p>`;
  }
}

function pintarPlanejamento(aba) {
  const m = document.getElementById('workflow-modal');
  const p = PLJ_ABERTO;
  if (!m || !p) return;
  const edita = p.pode_editar && !['aprovado', 'cadastrado', 'arquivado'].includes(p.estado);
  if (aba === 'editar' && !edita) aba = 'documento';
  const abas = [['documento', aba === 'documento' ? 'Documento' : '← Documento'], ...(edita ? [['editar', 'Editar']] : []), ['historico', 'Histórico'], ...(p.pode_editar ? [['identidade', 'Marca do cliente']] : [])];
  const resposta = p.estado === 'ajustes' && p.resposta_texto
    ? `<div class="plj-pedido"><b>${pljEsc(p.resposta_nome || 'O cliente')} pediu ajustes</b><p>${pljEsc(p.resposta_texto)}</p><small>As peças com pedido aparecem marcadas na aba Editar.</small></div>` : '';
  const drive = p.drive_pdf_id || p.drive_doc_id ? `<span class="plj-drive">${p.drive_doc_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://docs.google.com/document/d/${pljEsc(p.drive_doc_id)}/edit">Documento no Drive ↗</a>` : ''}${
    p.drive_pdf_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://drive.google.com/file/d/${pljEsc(p.drive_pdf_id)}/view">PDF ↗</a>` : ''}</span>` : '';
  // Documento como um PDF em tela cheia; o resto flutua por cima (Paulo,
  // 20/10/2026: "abrir como se abrisse um PDF tela cheia mesmo").
  m.classList.toggle('plj-modo-doc', aba === 'documento');
  if (aba === 'documento') {
    const outras = abas.filter(([k]) => k !== 'documento');
    const revisando = p.pode_editar && ['revisar', 'ajustes'].includes(p.estado);
    m.innerHTML = `<iframe class="plj-previa" title="Documento do planejamento" sandbox="allow-scripts allow-popups allow-modals"></iframe>
    <div class="plj-flut plj-flut-topo">
      <button class="plj-flut-x" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button>
      <div class="plj-flut-nome"><b>${pljEsc(p.cliente)}</b><small>${pljEsc(pljMes(p.mes))} · versão ${pljEsc(p.versao)}</small></div>
      ${pljSelo(p.estado)}${pljEtapasHtml(p)}
      <div class="plj-flut-links">${outras.map(([k, r]) => `<button type="button" class="cli-porta" onclick="pljTrocarAba('${k}')">${k === 'editar' ? 'Editar o mês' : r}</button>`).join('')}${drive}</div>
    </div>
    ${resposta ? `<div class="plj-flut plj-flut-aviso">${resposta}</div>` : ''}
    <div class="plj-flut plj-flut-base">${revisando ? '<small class="plj-flut-dica">Em cada peça: <b>Peça OK</b>, <b>Ajustar</b> ou <b>Editar peça</b>.</small>' : ''}${pljDemandasCriadasHtml(p)}<div class="workflow-actions plj-acoes">${pljAcoesHtml(aba)}</div></div>`;
    m.dataset.aba = aba;
    pljCarregarPrevia(p);
    return;
  }
  m.innerHTML = `<div class="workflow-kicker"><span>Planejamento · ${pljEsc(p.cliente)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <div class="plj-topo"><h2 class="workflow-title">${pljEsc(pljMes(p.mes))}</h2>${pljSelo(p.estado)}<small>versão ${pljEsc(p.versao)} · ${p.origem === 'agente' ? 'publicado pelo agente' : 'feito no painel'}</small>${drive}</div>
    ${pljEtapasHtml(p)}${resposta}${pljDemandasCriadasHtml(p)}
    <div class="plj-abas" role="tablist">${abas.map(([k, r]) => `<button type="button" role="tab" aria-selected="${k === aba}" class="${k === aba ? 'ativa' : ''}" onclick="pljTrocarAba('${k}')">${r}</button>`).join('')}</div>
    <div class="plj-corpo">${aba === 'editar' ? pljEditorHtml() : aba === 'historico' ? pljHistoricoHtml() : aba === 'identidade' ? pljIdentidadeHtml()
      : `<iframe class="plj-previa" title="Documento do planejamento" sandbox="allow-scripts allow-popups allow-modals"></iframe>`}</div>
    <div class="workflow-actions plj-acoes">${pljAcoesHtml(aba)}</div>`;
  m.dataset.aba = aba;
  if (aba === 'identidade') pljCarregarLogosDrive();
}
// O documento entra pela moldura com o próprio HTML (srcdoc), sem script: o
// mesmo arquivo que vai para o Drive e para o cliente.
async function pljCarregarPrevia(p) {
  const moldura = document.querySelector('#workflow-modal .plj-previa');
  if (!moldura) return;
  try {
    const r = await fetch(`/api/painel?area=planejamentos&acao=previa&id=${encodeURIComponent(p.id)}&v=${p.versao}`, { credentials: 'same-origin', cache: 'no-store' });
    const html = await r.text();
    if (!r.ok) throw new Error((() => { try { return JSON.parse(html).error; } catch { return ''; } })() || 'Não foi possível montar o documento.');
    if (moldura.isConnected) moldura.srcdoc = html;
  } catch (e) {
    if (moldura.isConnected) moldura.srcdoc = `<p style="font:14px system-ui;padding:24px;color:#444">${pljEsc(e.message)}</p>`;
  }
}
// A prévia (sem acesso ao painel) pede a revisão de cada peça por mensagem; quem grava é esta janela.
window.addEventListener('message', async (e) => {
  const quadro = document.querySelector('#workflow-modal .plj-previa');
  if (!quadro || e.source !== quadro.contentWindow || e.data?.vybe !== 'planejamento-head' || !PLJ_ABERTO) return;
  const responde = (r) => quadro.contentWindow?.postMessage({ vybe: 'planejamento-head-resposta', id: e.data.id, ...r }, '*');
  const { assinatura, estado, nota } = e.data.dados || {};
  if (e.data.dados?.acao === 'editar') {
    try { await pljSalvarPecaDoDocumento(e.data.dados.indice, e.data.dados.peca); responde({ ok: true }); }
    catch (erro) { responde({ ok: false, erro: erro.message }); }
    return;
  }
  try {
    const d = await pljPedir('', { acao: 'revisar_peca', id: PLJ_ABERTO.id, assinatura, estado, nota });
    PLJ_ABERTO.revisao = d.resumo;
    const peca = (PLJ_ABERTO.conteudo?.pecas || []).find((x) => x.assinatura === assinatura);
    if (peca) peca.revisao_head = estado === 'limpar' ? null : { estado, nota };
    const rasc = (PLJ_RASCUNHO?.pecas || []).find((x) => x.assinatura === assinatura);
    if (rasc) rasc.revisao_head = peca?.revisao_head || null;
    document.querySelector('#workflow-modal .plj-etapas')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: pljEtapasHtml(PLJ_ABERTO) }).firstElementChild);
    responde({ ok: true });
  } catch (erro) { responde({ ok: false, erro: erro.message }); }
});
// Edição de uma peça direto no documento: grava a versão nova, deixa a peça com
// o OK de quem editou e volta para a mesma peça (Paulo, 20/10/2026).
async function pljSalvarPecaDoDocumento(indice, peca) {
  const c = PLJ_ABERTO.conteudo || {};
  const pecas = (c.pecas || []).map((x, i) => (i === indice ? { ...x, ...peca } : x));
  if (!pecas[indice]) throw new Error('Peça não encontrada. Recarregue o planejamento.');
  if (PLJ_ABERTO.estado === 'enviado' && !confirm('O planejamento está com o cliente. Salvar tira dele até você mandar de novo. Salvar?')) throw new Error('Edição cancelada.');
  const d = await pljPedir('', { acao: 'editar', id: PLJ_ABERTO.id, versao: PLJ_ABERTO.versao, titulo: PLJ_ABERTO.titulo, conteudo: { ...c, pecas } });
  const novo = (await pljPedir(`acao=detalhe&id=${encodeURIComponent(d.planejamento.id)}`)).planejamento;
  const alvo = (novo.conteudo?.pecas || []).findIndex((x) => x.tema === (peca.tema || '') && x.data === (peca.data || ''));
  if (alvo >= 0 && novo.conteudo.pecas[alvo].assinatura && ['revisar', 'ajustes'].includes(novo.estado)) {
    try { await pljPedir('', { acao: 'revisar_peca', id: novo.id, assinatura: novo.conteudo.pecas[alvo].assinatura, estado: 'ok', nota: '' }); } catch { /* fica sem o OK */ }
  }
  await abrirPlanejamento(novo.id, 'documento');
  const quadro = document.querySelector('#workflow-modal .plj-previa');
  quadro?.addEventListener('load', () => quadro.contentWindow?.postMessage({ vybe: 'planejamento-ir', n: alvo + 1 }, '*'), { once: true });
  showToast('Peça salva.', 'success');
  pljAtualizarFora();
}
function pljTrocarAba(aba) {
  if (document.getElementById('workflow-modal')?.dataset.aba === 'editar' && aba !== 'editar' && PLJ_SUJO) {
    if (!confirm('Sair sem salvar as alterações?')) return;
    pljEdDescartar(false);
  }
  pintarPlanejamento(aba);
}
function pljEdDescartar(repintar = true) {
  PLJ_RASCUNHO = JSON.parse(JSON.stringify(PLJ_ABERTO.conteudo || {}));
  delete PLJ_ABERTO._titulo;
  PLJ_SUJO = false;
  if (repintar) pintarPlanejamento('editar');
}

function pljAcoesHtml(aba) {
  const p = PLJ_ABERTO;
  if (!p.pode_editar) return '<small class="workflow-hint">Só o head do cliente e quem administra editam e mandam este planejamento.</small>';
  if (aba === 'editar') return `<span class="plj-ed-sujo${PLJ_SUJO ? ' sujo' : ''}" id="plj-ed-sujo" aria-live="polite">${PLJ_SUJO ? 'Alterações não salvas' : 'Tudo salvo'}</span><small class="plj-ed-atalho">⌘S salva</small>
    <button type="button" class="workflow-secondary" onclick="pljEdDescartar()">Descartar</button>
    <button type="button" class="workflow-primary" onclick="salvarPlanejamento(this)">Salvar alterações</button>`;
  if (aba === 'identidade') return `<button type="button" class="workflow-primary" onclick="salvarIdentidadePlanejamento(this)">Salvar marca</button>`;
  const botoes = [];
  // Cliente que não aprova: o head aprova e o time cadastra (Paulo, 20/10/2026).
  if (['revisar', 'ajustes'].includes(p.estado)) botoes.push(p.identidade?.nao_aprova
    ? `<button type="button" class="workflow-secondary" onclick="confirmarEnvioPlanejamento()">Mandar para o cliente</button><button type="button" class="workflow-primary" onclick="confirmarAprovacaoHead(true)">Aprovar e cadastrar →</button>`
    : `<button type="button" class="workflow-secondary" onclick="confirmarAprovacaoHead(false)">Aprovar sem o cliente</button><button type="button" class="workflow-primary" onclick="confirmarEnvioPlanejamento()">Mandar para o cliente →</button>`);
  if (p.estado === 'enviado') botoes.push(`<button type="button" class="workflow-secondary" onclick="if(confirm('Reabrir tira o planejamento do cliente: o link enviado deixa de valer até você mandar de novo. Reabrir?'))mudarEstadoPlanejamento('revisar')">Reabrir para editar</button>
    <button type="button" class="workflow-secondary" onclick="confirmarEnvioPlanejamento()">Gerar um link novo</button>`);
  if (p.estado === 'aprovado') botoes.push(`<button type="button" class="workflow-secondary" onclick="mudarEstadoPlanejamento('revisar')">Reabrir para editar</button>
    <button type="button" class="workflow-secondary" onclick="mudarEstadoPlanejamento('cadastrado')">Já cadastrei à mão</button>
    <button type="button" class="workflow-primary" onclick="confirmarCadastroPlanejamento()">Cadastrar as ${(p.conteudo?.pecas || []).length} peças →</button>`);
  return botoes.join('');
}

// ── Editor: lista à esquerda, o item escolhido à direita ─────────────────────
// Paulo, 20/10/2026: "tá horrível essa interface pra editar". No estilo dos
// apps do Mac: uma lista (mês, linhas, datas, peças) e o detalhe do item, em
// grupos. O que se digita vai direto para o rascunho (sem "colher" a tela).
let PLJ_SEL = 'mes';
let PLJ_SUJO = false;
let PLJ_FILTRO = 'todas';
const PLJ_COM_TELAS = ['Card', 'Carrossel', 'Stories', 'Outro'];
const pljSemNumero = (t) => String(t || '').replace(/^\s*\d{1,2}\s*[·.\-–:)]\s*/, '');
function pljEditorHtml() {
  const c = PLJ_RASCUNHO || {};
  if (PLJ_SEL.startsWith('peca:') && !c.pecas?.[Number(PLJ_SEL.slice(5))]) PLJ_SEL = 'mes';
  return `<div class="plj-ed"><aside class="plj-ed-lista" id="plj-ed-lista" aria-label="Partes do planejamento">${pljEdListaHtml()}</aside>
    <section class="plj-ed-detalhe" id="plj-ed-detalhe">${pljEdDetalheHtml()}</section></div>`;
}
function pljEdListaHtml() {
  const c = PLJ_RASCUNHO || {}, pecas = c.pecas || [];
  const item = (sel, icone, nome, extra = '') => `<button type="button" class="plj-ed-item${PLJ_SEL === sel ? ' sel' : ''}" onclick="pljEdSelecionar('${sel}')" aria-current="${PLJ_SEL === sel}"><i aria-hidden="true">${icone}</i><span>${nome}</span>${extra}</button>`;
  const situacao = (x) => x.revisao_cliente?.estado === 'ajuste' || x.revisao_head?.estado === 'ajustar' ? 'ruim' : x.revisao_cliente?.estado === 'aprovada' || x.revisao_head?.estado === 'ok' ? 'bom' : '';
  const passa = (x) => PLJ_FILTRO === 'todas' || (PLJ_FILTRO === 'pedido' && situacao(x) === 'ruim') || (PLJ_FILTRO === 'sem-ok' && !x.revisao_head);
  const filtro = (k, r) => `<button type="button" class="${PLJ_FILTRO === k ? 'sel' : ''}" onclick="PLJ_FILTRO='${k}';pljEdRepintarLista()">${r}</button>`;
  return `<p class="plj-ed-sec">Planejamento</p>
    ${item('mes', '◎', 'Visão do mês')}
    ${item('linhas', '≡', 'Linhas de conteúdo', `<em>${(c.linhas || []).length}</em>`)}
    ${item('datas', '▦', 'Datas do mês', `<em>${(c.datas || []).length}</em>`)}
    ${item('obs', '✎', 'Para combinar')}
    <div class="plj-ed-sec plj-ed-sec-pecas"><span>Peças <em>${pecas.length}</em></span><button type="button" class="plj-ed-mais" onclick="pljEdNovaPeca()" aria-label="Nova peça" title="Nova peça">+</button></div>
    <div class="plj-ed-filtros" role="group" aria-label="Filtrar peças">${filtro('todas', 'Todas')}${filtro('pedido', 'Com pedido')}${filtro('sem-ok', 'Sem OK')}</div>
    <div class="plj-ed-pecas">${pecas.map((x, i) => passa(x) ? `<button type="button" class="plj-ed-peca${PLJ_SEL === 'peca:' + i ? ' sel' : ''}" onclick="pljEdSelecionar('peca:${i}')" style="--f:${PLJ_COR_FORMATO[x.formato] || '#6b7280'}">
      <span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t"><b>${pljEsc(pljSemNumero(x.tema) || 'Sem tema')}</b><small>${pljEsc(x.formato || 'Card')} · ${pljEsc(x.data ? `${x.data.slice(8, 10)}/${x.data.slice(5, 7)}` : 'sem dia')}</small></span>${situacao(x) ? `<i class="s ${situacao(x)}" aria-label="${situacao(x) === 'ruim' ? 'Tem pedido de ajuste' : 'Aprovada'}"></i>` : ''}</button>` : '').join('') || '<p class="plj-ed-vazio">Nenhuma peça neste filtro.</p>'}</div>`;
}
const PLJ_COR_FORMATO = { Card: '#d9534f', Carrossel: '#c98a12', Reels: '#7b4bd6', Fotografia: '#2f8f5b', 'Vídeo': '#2c6fb3', Stories: '#d1497a', Outro: '#6b7280' };
// Campo ligado ao rascunho pelo caminho (ex.: "pecas.3.tema").
const pljCampo = (caminho, valor, { tipo = 'text', linhas = 0, rotulo = '', dica = '', max = 0, extra = '' } = {}) => {
  const id = 'plj-c-' + caminho.replace(/\W/g, '-');
  const campo = linhas ? `<textarea id="${id}" data-campo="${caminho}" rows="${linhas}"${max ? ` maxlength="${max}"` : ''}${extra}>${pljEsc(valor || '')}</textarea>`
    : `<input id="${id}" data-campo="${caminho}" type="${tipo}" value="${pljEsc(valor || '')}"${max ? ` maxlength="${max}"` : ''}${extra}>`;
  return `<label class="plj-ed-campo" for="${id}"><span>${rotulo}</span>${campo}${dica ? `<small>${dica}</small>` : ''}</label>`;
};
const pljGrupo = (titulo, corpo, rodape = '') => `<div class="plj-ed-bloco">${titulo ? `<p class="plj-ed-sec">${titulo}</p>` : ''}<div class="plj-ed-grupo">${corpo}</div>${rodape ? `<small class="plj-ed-rodape">${rodape}</small>` : ''}</div>`;
function pljEdDetalheHtml() {
  const c = PLJ_RASCUNHO || {};
  if (PLJ_SEL === 'mes') return `<div class="plj-ed-cab"><h3>Visão do mês</h3><p>O que o cliente lê primeiro no documento.</p></div>
    ${pljGrupo('', pljCampo('titulo', PLJ_ABERTO._titulo ?? PLJ_ABERTO.titulo, { rotulo: 'Título', max: 160 }) + pljCampo('resumo', c.resumo, { rotulo: 'Visão do mês', linhas: 5, max: 1500, dica: 'De 2 a 4 frases, para o cliente.' }))}`;
  if (PLJ_SEL === 'obs') return `<div class="plj-ed-cab"><h3>Para combinar</h3><p>O que precisa ser combinado com o cliente: fotos, gravação, preços.</p></div>
    ${pljGrupo('', pljCampo('observacoes', c.observacoes, { rotulo: 'Observações', linhas: 7, max: 2000 }))}`;
  if (PLJ_SEL === 'linhas') return `<div class="plj-ed-cab"><h3>Linhas de conteúdo</h3><p>Os assuntos do mês. As peças escolhem uma delas.</p></div>
    ${(c.linhas || []).map((l, i) => pljGrupo(`Linha ${i + 1}`, pljCampo(`linhas.${i}.titulo`, l.titulo, { rotulo: 'Nome', max: 80 }) + pljCampo(`linhas.${i}.texto`, l.texto, { rotulo: 'O que é', linhas: 2, max: 600 }),
      `<button type="button" class="plj-ed-link perigo" onclick="pljEdTirar('linhas', ${i})">Tirar esta linha</button>`)).join('')}
    <button type="button" class="plj-ed-acrescentar" onclick="pljEdAcrescentar('linhas')">+ Linha de conteúdo</button>`;
  if (PLJ_SEL === 'datas') return `<div class="plj-ed-cab"><h3>Datas do mês</h3><p>Feriados e datas que orientam o mês.</p></div>
    ${pljGrupo('', `<div class="plj-ed-datas">${(c.datas || []).map((d, i) => `<div class="plj-ed-data">${pljCampo(`datas.${i}.data`, d.data, { rotulo: 'Quando', max: 20, extra: ' placeholder="02/11 · seg"' })}${pljCampo(`datas.${i}.nome`, d.nome, { rotulo: 'Data', max: 80 })}${pljCampo(`datas.${i}.texto`, d.texto, { rotulo: 'Por que importa', max: 300 })}<button type="button" class="plj-ed-x" onclick="pljEdTirar('datas', ${i})" aria-label="Tirar esta data">×</button></div>`).join('') || '<p class="plj-ed-vazio">Nenhuma data ainda.</p>'}</div>`)}
    <button type="button" class="plj-ed-acrescentar" onclick="pljEdAcrescentar('datas')">+ Data</button>`;
  const i = Number(PLJ_SEL.slice(5)), x = (c.pecas || [])[i];
  if (!x) return '';
  const linhas = (c.linhas || []).map((l) => l.titulo).filter(Boolean);
  const video = ['Reels', 'Vídeo'].includes(x.formato);
  const telas = Array.isArray(x.telas) ? x.telas : String(x.telas || '').split('\n').filter(Boolean);
  const comTelas = PLJ_COM_TELAS.includes(x.formato) || telas.length;
  const n = String(i + 1).padStart(2, '0');
  return `<div class="plj-ed-cab plj-ed-cab-peca" style="--f:${PLJ_COR_FORMATO[x.formato] || '#6b7280'}"><span class="n">${n}</span><div><h3>${pljEsc(pljSemNumero(x.tema) || 'Peça sem tema')}</h3><p><b class="pill">${pljEsc(x.formato || 'Card')}</b> ${pljEsc(x.data ? new Date(x.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }) : 'sem dia')}</p></div>
      <div class="plj-ed-nav"><button type="button" onclick="pljEdSelecionar('peca:${i - 1}')" ${i === 0 ? 'disabled' : ''} aria-label="Peça anterior">↑</button><button type="button" onclick="pljEdSelecionar('peca:${i + 1}')" ${i >= c.pecas.length - 1 ? 'disabled' : ''} aria-label="Próxima peça">↓</button></div></div>
    ${pljRevisaoPecaHtml(x)}
    ${pljGrupo('Quando e formato', `<div class="plj-ed-lado">${pljCampo(`pecas.${i}.data`, x.data, { rotulo: 'Dia', tipo: 'date' })}<label class="plj-ed-campo"><span>Formato</span><select data-campo="pecas.${i}.formato" onchange="pljEdRepintarTudo()">${PLJ_FORMATOS.map((f) => `<option${f === x.formato ? ' selected' : ''}>${f}</option>`).join('')}</select></label></div>`)}
    ${pljGrupo('Conteúdo', pljCampo(`pecas.${i}.tema`, x.tema, { rotulo: 'Tema', max: 200 })
      + `<label class="plj-ed-campo"><span>Linha de conteúdo</span><select data-campo="pecas.${i}.linha"><option value="">Sem linha</option>${[...new Set([...linhas, x.linha].filter(Boolean))].map((l) => `<option${l === x.linha ? ' selected' : ''}>${pljEsc(l)}</option>`).join('')}</select></label>`
      + pljCampo(`pecas.${i}.objetivo`, x.objetivo, { rotulo: 'Objetivo', linhas: 2, max: 800, dica: 'Uma frase com o que a peça quer causar.' }))}
    ${comTelas ? pljGrupo(`Texto das telas · ${telas.length}`, `<ol class="plj-ed-telas">${telas.map((t, k) => `<li><span class="nt">${k + 1}</span><textarea data-campo="pecas.${i}.telas.${k}" rows="2" maxlength="600">${pljEsc(t)}</textarea>
        <div class="acoes"><button type="button" onclick="pljEdTela(${i}, ${k}, -1)" ${k === 0 ? 'disabled' : ''} aria-label="Subir a tela">↑</button><button type="button" onclick="pljEdTela(${i}, ${k}, 1)" ${k === telas.length - 1 ? 'disabled' : ''} aria-label="Descer a tela">↓</button><button type="button" onclick="pljEdTela(${i}, ${k}, 0)" aria-label="Tirar a tela">×</button></div></li>`).join('')}</ol>
        <button type="button" class="plj-ed-acrescentar dentro" onclick="pljEdTela(${i}, ${telas.length}, 'nova')">+ Tela</button>`) : ''}
    ${pljGrupo(video ? 'Roteiro' : 'Legenda', pljCampo(`pecas.${i}.legenda`, x.legenda, { rotulo: video ? 'Roteiro do vídeo' : 'Legenda pronta', linhas: 8, max: 5000, extra: ' data-contar="1"' }), `<span id="plj-conta">${String(x.legenda || '').length} caracteres</span>`)}
    ${pljGrupo('Apoio', pljCampo(`pecas.${i}.referencia`, x.referencia, { rotulo: 'Referência', linhas: 2, max: 6000, dica: 'Link ou descrição visual.' }) + pljCampo(`pecas.${i}.observacao`, x.observacao, { rotulo: 'Para o cliente decidir', linhas: 2, max: 1500 }))}
    <div class="plj-ed-fim"><button type="button" class="plj-ed-link" onclick="pljEdDuplicar(${i})">Duplicar peça</button><button type="button" class="plj-ed-link perigo" onclick="pljEdTirar('pecas', ${i})">Tirar esta peça</button></div>`;
}
function pljEdSelecionar(sel) {
  const n = sel.startsWith('peca:') ? Number(sel.slice(5)) : null;
  if (n !== null && (n < 0 || n >= (PLJ_RASCUNHO.pecas || []).length)) return;
  PLJ_SEL = sel;
  pljEdRepintarTudo();
  document.getElementById('plj-ed-detalhe')?.scrollTo({ top: 0 });
  document.querySelector('#plj-ed-lista .sel')?.scrollIntoView({ block: 'nearest' });
}
function pljEdRepintarLista() { const l = document.getElementById('plj-ed-lista'); if (l) l.innerHTML = pljEdListaHtml(); }
function pljEdRepintarTudo() {
  pljEdRepintarLista();
  const d = document.getElementById('plj-ed-detalhe');
  if (d) d.innerHTML = pljEdDetalheHtml();
}
function pljEdMarcarSujo() {
  PLJ_SUJO = true;
  const el = document.getElementById('plj-ed-sujo');
  if (el) { el.textContent = 'Alterações não salvas'; el.classList.add('sujo'); }
}
// Grava no rascunho o que a pessoa digita, pelo caminho do campo.
function pljEdAplicar(el) {
  const caminho = el.dataset.campo.split('.');
  if (caminho[0] === 'titulo') PLJ_ABERTO._titulo = el.value;
  else {
    let alvo = PLJ_RASCUNHO;
    for (let k = 0; k < caminho.length - 1; k++) {
      const chave = caminho[k];
      if (chave === 'telas' && !Array.isArray(alvo.telas)) alvo.telas = String(alvo.telas || '').split('\n').filter(Boolean);
      alvo = alvo[chave] ??= {};
    }
    alvo[caminho.at(-1)] = el.value;
  }
  pljEdMarcarSujo();
  if (el.dataset.contar) { const c = document.getElementById('plj-conta'); if (c) c.textContent = `${el.value.length} caracteres`; }
  if (/^pecas\.\d+\.(tema|data|formato)$/.test(el.dataset.campo)) pljEdRepintarLista();
}
document.addEventListener('input', (e) => { const el = e.target.closest?.('#workflow-modal .plj-ed [data-campo]'); if (el) pljEdAplicar(el); });
document.addEventListener('change', (e) => { const el = e.target.closest?.('#workflow-modal .plj-ed select[data-campo]'); if (el) pljEdAplicar(el); });
document.addEventListener('keydown', (e) => {
  if (document.getElementById('workflow-modal')?.dataset.aba !== 'editar') return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); document.querySelector('#workflow-modal .plj-acoes .workflow-primary')?.click(); return; }
  if (['ArrowUp', 'ArrowDown'].includes(e.key) && e.target.closest?.('#plj-ed-lista') && PLJ_SEL.startsWith('peca:')) {
    e.preventDefault(); pljEdSelecionar(`peca:${Number(PLJ_SEL.slice(5)) + (e.key === 'ArrowUp' ? -1 : 1)}`);
    document.querySelector('#plj-ed-lista .sel')?.focus();
  }
});
function pljEdNovaPeca() {
  (PLJ_RASCUNHO.pecas ||= []).push({ data: PLJ_ABERTO.mes, formato: 'Card', tema: '', linha: '', objetivo: '', telas: [], legenda: '', referencia: '', observacao: '' });
  pljEdMarcarSujo(); pljEdSelecionar(`peca:${PLJ_RASCUNHO.pecas.length - 1}`);
  document.getElementById('plj-c-pecas-' + (PLJ_RASCUNHO.pecas.length - 1) + '-tema')?.focus();
}
function pljEdDuplicar(i) {
  const { assinatura, revisao_head, revisao_cliente, conteudo_id, ajuste_cliente, ...copia } = PLJ_RASCUNHO.pecas[i];
  PLJ_RASCUNHO.pecas.splice(i + 1, 0, JSON.parse(JSON.stringify(copia)));
  pljEdMarcarSujo(); pljEdSelecionar(`peca:${i + 1}`);
}
function pljEdAcrescentar(k) {
  (PLJ_RASCUNHO[k] ||= []).push(k === 'linhas' ? { titulo: '', texto: '' } : { data: '', nome: '', texto: '' });
  pljEdMarcarSujo(); pljEdRepintarTudo();
}
function pljEdTirar(k, i) {
  const nome = k === 'pecas' ? `a peça ${String(i + 1).padStart(2, '0')}` : k === 'linhas' ? 'esta linha' : 'esta data';
  if (!confirm(`Tirar ${nome}? Só vale depois de salvar.`)) return;
  PLJ_RASCUNHO[k].splice(i, 1);
  if (k === 'pecas') PLJ_SEL = PLJ_RASCUNHO.pecas.length ? `peca:${Math.min(i, PLJ_RASCUNHO.pecas.length - 1)}` : 'mes';
  pljEdMarcarSujo(); pljEdRepintarTudo();
}
// Telas: subir (-1), descer (1), tirar (0) ou acrescentar ('nova').
function pljEdTela(i, k, mov) {
  const x = PLJ_RASCUNHO.pecas[i];
  const telas = x.telas = Array.isArray(x.telas) ? x.telas : String(x.telas || '').split('\n').filter(Boolean);
  if (mov === 'nova') telas.push('');
  else if (mov === 0) telas.splice(k, 1);
  else { const j = k + mov; [telas[k], telas[j]] = [telas[j], telas[k]]; }
  pljEdMarcarSujo();
  const d = document.getElementById('plj-ed-detalhe'), topo = d?.scrollTop;
  pljEdRepintarTudo();
  if (d) d.scrollTop = topo;
  if (mov === 'nova') document.querySelector(`[data-campo="pecas.${i}.telas.${telas.length - 1}"]`)?.focus();
}
// Placar curto da revisão para listas: o que o head já viu ou o que o cliente já respondeu.
function pljPlacar(p) {
  const r = p.revisao || {};
  if (!r.total) return '';
  if (['revisar', 'ajustes'].includes(p.estado) && !r.cliente_ajustes) return ` · ${r.head_ok} de ${r.total} OK`;
  if (p.estado === 'ajustes') return ` · ${r.cliente_ajustes} com ajuste do cliente`;
  if (p.estado === 'enviado') return ` · cliente respondeu ${r.cliente_aprovadas + r.cliente_ajustes} de ${r.total}`;
  return '';
}
// Situação da peça no editor: o que o cliente respondeu e a revisão interna do
// head. A revisão em si se faz na aba Documento.
function pljRevisaoPecaHtml(x) {
  const c = x.revisao_cliente, h = x.revisao_head;
  const doCliente = c ? `<div class="plj-rev-cli ${c.estado === 'aprovada' ? 'ok' : 'ruim'}"><b>${c.estado === 'aprovada' ? 'Cliente aprovou' : 'Cliente pediu ajuste'}${c.nome ? ` · ${pljEsc(c.nome)}` : ''}</b>${c.nota ? `<p>${pljEsc(c.nota)}</p>` : ''}</div>` : '';
  const doHead = h ? `<div class="plj-rev-cli ${h.estado === 'ok' ? 'ok' : 'ruim'}"><b>${h.estado === 'ok' ? 'OK na revisão' : 'Ajustar'}${h.por ? ` · ${pljEsc(h.por)}` : ''}</b>${h.nota ? `<p>${pljEsc(h.nota)}</p>` : ''}</div>` : '';
  return doCliente + doHead;
}
// Etapas no topo: onde o planejamento está e o que vem agora.
function pljEtapasHtml(p) {
  const ordem = ['revisar', 'enviado', 'aprovado', 'cadastrado'];
  const atual = p.estado === 'ajustes' ? 0 : Math.max(0, ordem.indexOf(p.estado));
  const nomes = ['Revisar', 'Com o cliente', 'Aprovado', 'Cadastrado'];
  const proximo = { revisar: 'Revise e mande para o cliente.', ajustes: 'O cliente pediu ajustes: corrija e mande de novo.', enviado: 'Esperando a resposta do cliente pelo link.', aprovado: 'Aprovado: cadastre as peças.', cadastrado: 'Peças cadastradas no painel.' }[p.estado] || '';
  const r = p.revisao || {};
  const interno = ['revisar', 'ajustes'].includes(p.estado) && r.total ? `<span class="plj-rev">Sua revisão: <b>${r.head_ok} de ${r.total} OK</b>${r.head_ajustar ? ` · <b class="ruim">${r.head_ajustar} para ajustar</b>` : ''}</span>` : '';
  const cliente = ['enviado', 'ajustes', 'aprovado'].includes(p.estado) && r.total && (r.cliente_aprovadas || r.cliente_ajustes) ? `<span class="plj-rev">Cliente: <b class="bom">${r.cliente_aprovadas} aprovadas</b>${r.cliente_ajustes ? ` · <b class="ruim">${r.cliente_ajustes} com ajuste</b>` : ''}${r.total - r.cliente_aprovadas - r.cliente_ajustes > 0 ? ` · ${r.total - r.cliente_aprovadas - r.cliente_ajustes} sem resposta` : ''}</span>` : '';
  return `<div class="plj-etapas" aria-label="Etapas do planejamento"><ol>${nomes.map((n, i) => `<li class="${i < atual ? 'feita' : i === atual ? 'agora' : ''}${i === 0 && p.estado === 'ajustes' ? ' ajustes' : ''}"><i>${i < atual ? '✓' : i + 1}</i><span>${i === 0 && p.estado === 'ajustes' ? 'Ajustar' : n}</span></li>`).join('')}</ol><small>${pljEsc(proximo)}</small>${interno || cliente ? `<div class="plj-revs">${interno}${cliente}</div>` : ''}</div>`;
}
// O editor grava no rascunho a cada tecla (pljEdAplicar); nada a colher da tela.
function pljColher() {}
async function salvarPlanejamento(botao) {
  pljColher();
  botao.disabled = true;
  try {
    const d = await pljPedir('', { acao: 'editar', id: PLJ_ABERTO.id, versao: PLJ_ABERTO.versao, titulo: PLJ_ABERTO._titulo ?? PLJ_ABERTO.titulo, conteudo: PLJ_RASCUNHO });
    showToast(PLJ_ABERTO.estado === 'enviado' ? 'Salvo. O link antigo deixou de valer; mande de novo quando quiser.' : 'Planejamento salvo.', 'success', 4000);
    PLJ_SUJO = false;
    await abrirPlanejamento(d.planejamento.id, 'editar');
    pljAtualizarFora();
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 6000); }
}

// ── Histórico e identidade ───────────────────────────────────────────────────
const PLJ_EVENTOS = { publicado: 'Publicado pelo agente', nova_versao: 'Nova versão do agente', editado: 'Editado', enviado: 'Mandado para o cliente',
  aprovado: 'Aprovado', ajustes: 'Cliente pediu ajustes', cadastrado: 'Peças cadastradas', arquivado: 'Arquivado', comentario: 'Comentário', email: 'E-mail' };
function pljHistoricoHtml() {
  const ev = PLJ_ABERTO.eventos || [];
  // Linha do tempo: quem fez o quê; comentários e pedidos do cliente como conversa.
  const tom = { aprovado: 'ok', cadastrado: 'ok', ajustes: 'ruim', enviado: 'azul', comentario: 'fala', publicado: 'agente', nova_versao: 'agente' };
  return `<div class="plj-comentar"><textarea id="plj-comentario" rows="2" maxlength="4000" aria-label="Comentário para a equipe" placeholder="Escreva para a equipe (o agente também lê). Ex.: trocar a peça do dia 12 por um Reels"></textarea>
      <button type="button" class="workflow-secondary" onclick="comentarPlanejamento(this)">Comentar</button></div>
    <ol class="plj-tempo">${ev.map((e) => `<li class="${tom[e.tipo] || ''}${e.texto && ['comentario', 'ajustes'].includes(e.tipo) ? ' com-fala' : ''}"><i aria-hidden="true"></i><div>
      <b>${pljEsc(PLJ_EVENTOS[e.tipo] || e.tipo)}</b><small>${pljEsc(pljQuando(e.em))}${e.autor || e.autor_externo ? ' · ' + pljEsc(e.autor || e.autor_externo) : ''}${e.versao ? ' · versão ' + pljEsc(e.versao) : ''}</small>
      ${e.texto ? `<p>${pljEsc(e.texto)}</p>` : ''}</div></li>`).join('') || '<li class="plj-vazio">Sem histórico ainda.</li>'}</ol>`;
}
async function comentarPlanejamento(botao) {
  const texto = document.getElementById('plj-comentario')?.value.trim();
  if (!texto) return;
  botao.disabled = true;
  try { await pljPedir('', { acao: 'comentar', id: PLJ_ABERTO.id, texto }); await abrirPlanejamento(PLJ_ABERTO.id, 'historico'); }
  catch (e) { botao.disabled = false; showToast(e.message, 'error', 5000); }
}
function pljIdentidadeHtml() {
  const i = PLJ_ABERTO.identidade || {};
  // Padrão Vybe para todos; do cliente entra o logo (Paulo, 20/10/2026).
  return `<p class="workflow-copy">O documento tem o visual da Vybe para todos os clientes. Daqui entra o logo do cliente, ao lado do logo da Vybe na capa, e o tom de voz que o agente segue.</p>
    <div class="plj-identidade">
      <label class="workflow-field"><span>Logo do cliente (endereço https da imagem)</span><input id="plj-logo" type="url" value="${pljEsc(i.logo || '')}" placeholder="https://…/logo.png" oninput="pljPreverLogo(this.value)"></label>
      <div class="plj-logo-previa" id="plj-logo-previa">${i.logo ? `<img src="${pljEsc(i.logo)}" alt="Logo do cliente">` : i.logo_drive ? `<img src="/api/painel?area=logo&c=${pljEsc(PLJ_ABERTO.cliente_id)}&v=${pljEsc(i.logo_drive)}" alt="Logo do cliente (do Drive)">` : '<small>Sem logo: a capa mostra o nome do cliente.</small>'}</div>
      <div class="plj-logos-drive" id="plj-logos-drive"><small>Procurando os logos no Drive…</small></div>
      <label class="workflow-field"><span>Tom de voz (para o agente)</span><textarea id="plj-tom" rows="3" maxlength="400">${pljEsc(i.tom || '')}</textarea></label>
      <label class="plj-check plj-nao-aprova"><input id="plj-nao-aprova" type="checkbox" ${i.nao_aprova ? 'checked' : ''}> <span><b>Este cliente não aprova o planejamento</b><small>O head aprova direto e o botão principal vira "Aprovar e cadastrar". Mandar ao cliente continua possível.</small></span></label>
    </div>`;
}
// Logos do cliente achados no Drive: um clique escolhe (vale para a capa de todos os planejamentos).
async function pljCarregarLogosDrive() {
  const caixa = document.getElementById('plj-logos-drive');
  if (!caixa) return;
  try {
    const d = await pljPedir(`acao=logos&cliente_id=${encodeURIComponent(PLJ_ABERTO.cliente_id)}`);
    if (!caixa.isConnected) return;
    const atual = PLJ_ABERTO.identidade?.logo_drive;
    caixa.innerHTML = d.logos?.length ? `<span>Logos no Drive (clique para usar):</span><div class="plj-logos-grade">${d.logos.map((l) => `<button type="button" class="${l.id === atual ? 'ativo' : ''}" title="${pljEsc(l.nome)}" onclick="pljUsarLogoDrive('${pljEsc(l.id)}', this)">${l.miniatura ? `<img src="${pljEsc(l.miniatura)}" alt="" referrerpolicy="no-referrer">` : ''}<small>${pljEsc(l.nome)}</small></button>`).join('')}</div>`
      : `<small>${pljEsc(d.aviso || 'Nenhuma imagem com "logo" e o nome do cliente no Drive. Cole o endereço de uma imagem acima.')}</small>`;
  } catch (e) { if (caixa.isConnected) caixa.innerHTML = `<small>Não deu para procurar no Drive: ${pljEsc(e.message)}</small>`; }
}
async function pljUsarLogoDrive(id, botao) {
  botao.disabled = true;
  try {
    const d = await pljPedir('', { acao: 'identidade', cliente_id: PLJ_ABERTO.cliente_id, logo: '', logo_drive: id, tom: document.getElementById('plj-tom')?.value || '', nao_aprova: PLJ_ABERTO.identidade?.nao_aprova === true });
    PLJ_ABERTO.identidade = d.identidade;
    showToast('Logo escolhido. A capa já sai com ele.', 'success');
    pintarPlanejamento('identidade');
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 5000); }
}
function pljPreverLogo(v) {
  const el = document.getElementById('plj-logo-previa');
  if (el) el.innerHTML = /^https:\/\/\S{4,500}$/.test(v) ? `<img src="${pljEsc(v)}" alt="Logo do cliente" onerror="this.replaceWith(Object.assign(document.createElement('small'),{textContent:'Não deu para abrir essa imagem.'}))">` : '<small>Sem logo: a capa mostra o nome do cliente.</small>';
}
async function salvarIdentidadePlanejamento(botao) {
  botao.disabled = true;
  const v = (id) => document.getElementById(id)?.value || '';
  try {
    const d = await pljPedir('', { acao: 'identidade', cliente_id: PLJ_ABERTO.cliente_id, logo: v('plj-logo'), logo_drive: v('plj-logo') ? '' : PLJ_ABERTO.identidade?.logo_drive || '', tom: v('plj-tom'), nao_aprova: document.getElementById('plj-nao-aprova')?.checked === true });
    PLJ_ABERTO.identidade = d.identidade;
    showToast('Salvo. O documento já sai com o logo.', 'success');
    pintarPlanejamento('documento');
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 5000); }
}

// ── Mandar para o cliente ───────────────────────────────────────────────────
async function confirmarAprovacaoHead(cadastrar) {
  const p = PLJ_ABERTO, r = p.revisao || {}, falta = (r.total || 0) - (r.head_ok || 0);
  const aviso = falta > 0 ? `\n\n${r.head_ajustar ? `${r.head_ajustar} ${r.head_ajustar === 1 ? 'peça está marcada' : 'peças estão marcadas'} para ajustar` : `${falta} ${falta === 1 ? 'peça está' : 'peças estão'} sem o seu OK`}.` : '';
  if (!confirm(`Aprovar o planejamento de ${p.cliente} sem mandar ao cliente?${aviso}\n\nFica registrado no histórico como aprovado pelo head.`)) return;
  try {
    const d = await pljPedir('', { acao: 'aprovar_head', id: p.id, versao: p.versao });
    showToast('Planejamento aprovado.', 'success');
    await abrirPlanejamento(d.planejamento.id, 'documento');
    pljAtualizarFora();
    if (cadastrar) confirmarCadastroPlanejamento();
  } catch (e) { showToast(e.message, 'error', 6000); }
}
function confirmarEnvioPlanejamento() {
  const acoes = document.querySelector('#workflow-modal .plj-acoes');
  if (!acoes) return;
  const r = PLJ_ABERTO.revisao || {}, falta = (r.total || 0) - (r.head_ok || 0);
  acoes.innerHTML = `${falta > 0 ? `<p class="plj-aviso-falha">${r.head_ajustar ? `${r.head_ajustar} ${r.head_ajustar === 1 ? 'peça marcada' : 'peças marcadas'} para ajustar` : `${falta} ${falta === 1 ? 'peça' : 'peças'} sem o seu OK`}. Dá para mandar assim mesmo.</p>` : ''}<label class="plj-check"><input id="plj-email" type="checkbox" checked> Mandar cópia para o e-mail do cliente</label>
    <button type="button" class="workflow-secondary" onclick="pintarPlanejamento('documento')">Voltar</button>
    <button type="button" class="workflow-primary" onclick="enviarPlanejamento(this)">Gerar link e salvar no Drive →</button>`;
}
async function enviarPlanejamento(botao) {
  botao.disabled = true;
  botao.textContent = 'Gerando…';
  try {
    const d = await pljPedir('', { acao: 'enviar', id: PLJ_ABERTO.id, email: document.getElementById('plj-email')?.checked !== false });
    PLJ_ABERTO = { ...d.planejamento };
    pintarPlanejamento('documento');
    // O cliente aprova pelo VybeHub dele (Paulo, 20/10/2026); o link direto
    // continua para quem não entrou no portal.
    // Um link só: o do VybeHub do cliente (Paulo, 20/10/2026: "não era pra gerar 2 links").
    // O link direto fica guardado para cliente sem acesso ao portal.
    const portal = typeof ESCRITORIO_VYBEHUB !== 'undefined' && typeof escritorioSlugCliente === 'function'
      ? `${ESCRITORIO_VYBEHUB}/cliente/${escritorioSlugCliente(PLJ_ABERTO.cliente)}/planejamentos` : '';
    const principal = portal || d.link;
    const texto = `Olá! O planejamento de conteúdo de ${pljMes(PLJ_ABERTO.mes).toLowerCase()} está ${portal ? 'no seu VybeHub' : 'pronto'} para você aprovar peça por peça: ${principal}`;
    const m = document.getElementById('workflow-modal');
    (m?.querySelector('.plj-topo') || m?.querySelector('.plj-flut-topo'))?.insertAdjacentHTML('afterend', `<div class="plj-link">
      <b>Pronto. Mande para o cliente no WhatsApp:</b>
      <div class="plj-link-linha"><input type="text" readonly value="${pljEsc(principal)}" aria-label="Link para o cliente" onclick="this.select()">
        <button type="button" class="cli-porta" onclick="pljCopiar(this, '${pljEsc(principal)}')">Copiar</button>
        <a class="cli-porta" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Abrir no WhatsApp ↗</a></div>
      ${portal ? `<details class="plj-reserva"><summary>Cliente sem acesso ao VybeHub?</summary><small>Link direto, sem login (vale 30 dias):</small>
        <div class="plj-link-linha"><input type="text" readonly value="${pljEsc(d.link)}" aria-label="Link direto" onclick="this.select()"><button type="button" class="cli-porta" onclick="pljCopiar(this, '${pljEsc(d.link)}')">Copiar</button></div></details>` : ''}
      <small>Se você editar o planejamento, ele sai do cliente até você mandar de novo.</small>
      ${(d.avisos || []).map((a) => `<p class="plj-aviso-falha">${pljEsc(a)}</p>`).join('')}</div>`);
    pljAtualizarFora();
  } catch (e) { botao.disabled = false; botao.textContent = 'Gerar link e salvar no Drive →'; showToast(e.message, 'error', 6000); }
}
function pljCopiar(botao, texto) {
  navigator.clipboard?.writeText(texto).then(() => { botao.textContent = 'Copiado'; }, () => showToast('Não deu para copiar; selecione o link e copie.', 'error'));
}
async function mudarEstadoPlanejamento(estado) {
  try {
    await pljPedir('', { acao: 'estado', id: PLJ_ABERTO.id, estado });
    showToast(estado === 'cadastrado' ? 'Marcado como cadastrado.' : 'Reaberto para edição.', 'success');
    await abrirPlanejamento(PLJ_ABERTO.id, estado === 'revisar' ? 'editar' : 'documento');
    pljAtualizarFora();
  } catch (e) { showToast(e.message, 'error', 5000); }
}

// Depois do botão, cada peça aponta para a demanda criada.
function pljDemandasCriadasHtml(p) {
  const feitas = (p.conteudo?.pecas || []).filter((x) => x.conteudo_id);
  if (!feitas.length) return '';
  const dia = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '');
  return `<details class="plj-criadas"><summary>${feitas.length} ${feitas.length === 1 ? 'demanda criada' : 'demandas criadas'} a partir deste planejamento</summary><ul>${feitas.map((x) =>
    `<li><button type="button" class="cli-porta" onclick="closeWorkflowModal();${x.formato === 'Outro' ? 'openDemandaWorkspace' : 'openItemWorkspace'}('vybe:${pljEsc(x.conteudo_id)}')">${pljEsc(PLJ_FORMATO_DO_PAINEL[x.formato] || x.formato)} - ${pljEsc(x.tema || 'Sem tema')}</button><small>veicula ${pljEsc(dia(x.data))}</small></li>`).join('')}</ul></details>`;
}
// ── Cadastrar as peças aprovadas (Paulo, 20/10/2026) ─────────────────────────
// Destino, status, captação e equipe saem da mesma regra do formulário de
// cadastro (cadastrosDestiny); o servidor cria tudo numa transação, com o Prazo
// de Ouro e quem mais fez peças do cliente.
const PLJ_FORMATO_DO_PAINEL = { Card: 'Card', Carrossel: 'Carrossel', Reels: 'Reels', Fotografia: 'Fotografia', 'Vídeo': 'Vídeo', Stories: 'Story', Outro: 'Avulso' };
function pljDestinos() {
  const destinos = {};
  for (const f of PLJ_FORMATOS) {
    if (f === 'Outro' || typeof cadastrosDestiny !== 'function') continue;
    const d = cadastrosDestiny(PLJ_FORMATO_DO_PAINEL[f], true, false, []);
    destinos[f] = { grupo_id: d.group, grupo: d.groupLabel, status: chaveDeStatus(d.status), statusRotulo: d.status, captacao: d.capture ? 'Agendar Captação' : '', responsaveis: (d.assignees || []).map(String) };
  }
  return destinos;
}
function confirmarCadastroPlanejamento() {
  const p = PLJ_ABERTO, pecas = (p.conteudo?.pecas || []).filter((x) => !x.conteudo_id), destinos = pljDestinos();
  const nomes = (ids) => (ids || []).map((id) => (typeof TEAM_USERS !== 'undefined' ? TEAM_USERS : []).find((u) => String(u.id) === String(id))?.name?.split(' ')[0]).filter(Boolean);
  const porFormato = Object.entries(pecas.reduce((t, x) => ((t[x.formato] = (t[x.formato] || 0) + 1), t), {}));
  const linha = ([f, n]) => { const d = destinos[f]; const onde = f === 'Outro' ? 'Solicitações de demanda, para triagem' : `${d?.grupo || 'Produção'} · ${d?.statusRotulo || ''}${d?.captacao ? ' · com captação' : ''}`;
    const equipe = nomes(d?.responsaveis); return `<li><b>${n} ${pljEsc(PLJ_FORMATO_DO_PAINEL[f] || f)}</b><span>${pljEsc(onde)}</span><small>${f === 'Outro' ? 'Sem responsável: quem faz a triagem distribui.' : equipe.length > 1 ? `Para quem mais fez peças de ${pljEsc(p.cliente)}; sem histórico, ${pljEsc(equipe.join(', '))}.` : equipe.length ? `Para ${pljEsc(equipe[0])}.` : 'Para a fila de Produção (captação).'}</small></li>`; };
  openWorkflowModal(`<div class="workflow-kicker"><span>Planejamento · ${pljEsc(p.cliente)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="abrirPlanejamento('${pljEsc(p.id)}')">×</button></div>
    <h2 class="workflow-title">Cadastrar ${pecas.length} ${pecas.length === 1 ? 'peça' : 'peças'}</h2>
    <p class="workflow-copy">Cada peça vira uma demanda de ${pljEsc(p.cliente)}, com o tema no título, a legenda ou roteiro no briefing e o dia como veiculação. O prazo é o Prazo de Ouro (7 dias antes); se já passou, fica para hoje, nunca a menos de 2 dias da veiculação.</p>
    <ul class="plj-cadastro">${porFormato.map(linha).join('')}</ul>
    <p class="workflow-hint">Entram todas de uma vez: se alguma falhar, nenhuma é criada. Depois o planejamento fica como Cadastrado.</p>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="abrirPlanejamento('${pljEsc(p.id)}')">Voltar</button>
      <button type="button" class="workflow-primary" onclick="cadastrarPecasPlanejamento(this)">Cadastrar agora</button></div>`);
}
async function cadastrarPecasPlanejamento(botao) {
  botao.disabled = true; botao.textContent = 'Cadastrando…';
  try {
    const d = await pljPedir('', { acao: 'cadastrar', id: PLJ_ABERTO.id, versao: PLJ_ABERTO.versao, destinos: pljDestinos() });
    showToast(`${d.criadas.length} ${d.criadas.length === 1 ? 'demanda criada' : 'demandas criadas'} para ${PLJ_ABERTO.cliente}.`, 'success', 5000);
    if (typeof refreshData === 'function') refreshData({ boardCriado: 'producao' });
    await abrirPlanejamento(d.planejamento.id, 'documento');
    pljAtualizarFora();
  } catch (e) { botao.disabled = false; botao.textContent = 'Cadastrar agora'; showToast(e.message, 'error', 7000); }
}

// Depois de mudar algo, o cartão do cliente e o aviso do head se refazem.
function pljAtualizarFora() {
  if (document.getElementById('plj-cartao') && PLJ_ABERTO) carregarPlanejamentosDoCliente(PLJ_ABERTO.cliente_id, PLJ_ABERTO.cliente);
  vigiarPlanejamentosPendentes(true);
}

// ── Aviso para o head: o que espera por ele ─────────────────────────────────
// Para revisar (o agente publicou) ou com ajustes pedidos pelo cliente, nos
// clientes em que a pessoa é head. Aparece na tela inteira do painel e no
// Escritório (escritorioPlanejamentosPendentes), levando ao Centro de Operação.
let PLJ_RELOGIO = null;
async function vigiarPlanejamentosPendentes(agora) {
  if (!agora && document.hidden) return;
  try {
    const r = await fetch('/api/painel?area=planejamentos&acao=pendentes', { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    PLJ_PENDENTES = Array.isArray(d.pendentes) ? d.pendentes : [];
    PLJ_ALERTAS = Array.isArray(d.alertas) ? d.alertas : [];
  } catch { return; }
  pintarAvisoPlanejamentos();
  if (typeof escritorioPlanejamentosPendentes === 'function') escritorioPlanejamentosPendentes(PLJ_PENDENTES);
}
function pintarAvisoPlanejamentos() {
  let el = document.getElementById('plj-aviso');
  const avisos = PLJ_ALERTAS.reduce((t, a) => t + (a.total || 0), 0);
  if (!PLJ_PENDENTES.length && !avisos) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.id = 'plj-aviso';
    el.type = 'button';
    el.className = 'plj-aviso';
    el.onclick = abrirPendentesPlanejamento;
    document.body.append(el);
  }
  const n = PLJ_PENDENTES.length;
  const ajustes = PLJ_PENDENTES.filter((p) => p.estado === 'ajustes').length;
  // Planejamento esperando é ação do head: vem primeiro, com o nome do cliente.
  const um = n === 1 ? PLJ_PENDENTES[0] : null;
  const acao = { revisar: 'planejamento para revisar', ajustes: 'cliente pediu ajustes', aprovado: 'aprovado, cadastrar as peças' };
  const titulo = [n && (um ? `${um.cliente}: ${acao[um.estado] || 'planejamento esperando você'}` : `${n} planejamentos esperando você`), avisos && `${avisos} aviso${avisos > 1 ? 's' : ''} nos seus clientes`].filter(Boolean).join(' · ');
  el.classList.toggle('urgente', n > 0);
  const clientes = [...new Set([...PLJ_PENDENTES.map((p) => p.cliente), ...PLJ_ALERTAS.map((a) => a.cliente)])].slice(0, 3).join(', ');
  el.innerHTML = `<span class="plj-aviso-ponto" aria-hidden="true"></span><span><b>${pljEsc(titulo)}</b>
    <small>${ajustes ? `${ajustes} com ajustes do cliente · ` : ''}${pljEsc(clientes)}</small></span>`;
  el.title = PLJ_ALERTAS.map((a) => `${a.cliente}: ${[a.atrasadas_total && `${a.atrasadas_total} muito atrasada(s)`, a.aprovar_total && `${a.aprovar_total} para aprovar`, a.sem_info_total && `${a.sem_info_total} sem informação`].filter(Boolean).join(', ')}`).join('\n');
}
function abrirPendentesPlanejamento() {
  openWorkflowModal(`<div class="workflow-kicker"><span>Planejamentos · Centro de Operação</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Esperando você</h2>
    <p class="workflow-copy">Planejamentos para revisar e o que pede atenção nas peças dos seus clientes.</p>
    ${PLJ_PENDENTES.length ? `<ul class="plj-meses">${PLJ_PENDENTES.map((p) => `<li><button type="button" class="plj-mes" onclick="abrirPlanejamento('${pljEsc(p.id)}')">
      <b>${pljEsc(p.cliente)}</b><small>${pljEsc(pljMes(p.mes))} · ${pljEsc(p.titulo)}</small>${pljSelo(p.estado)}</button></li>`).join('')}</ul>` : ''}
    ${PLJ_ALERTAS.length ? `<h3 class="plj-avisos-titulo">Avisos nos seus clientes</h3><ul class="plj-avisos">${PLJ_ALERTAS.map((a) => `<li><b>${pljEsc(a.cliente)}</b>
      ${[['Muito atrasadas', a.atrasadas, a.atrasadas_total, 'status'], ['Para aprovar', a.aprovar, a.aprovar_total, 'status'], ['Sem informação', a.sem_info, a.sem_info_total, 'motivo']].filter(([, , t]) => t).map(([rot, itens, t, campo]) => `<details><summary>${rot} · ${t}</summary><ul>${itens.map((x) => `<li><button type="button" onclick="closeWorkflowModal();pljAbrirPeca('${pljEsc(x.ref)}','${x.quadro}')"><span>${pljEsc(x.titulo)}</span><small>${pljEsc([x.prazo ? x.prazo.split('-').reverse().join('/') : '', x[campo]].filter(Boolean).join(' · '))}</small></button></li>`).join('')}</ul></details>`).join('')}</li>`).join('')}</ul>` : ''}
    ${typeof irParaSalaEscritorio === 'function' ? `<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal();irParaSalaEscritorio('operacao')">Ir ao Centro de Operação</button></div>` : ''}`);
}
function iniciarVigiaPlanejamentos() {
  if (PLJ_RELOGIO) return;
  vigiarPlanejamentosPendentes(true);
  PLJ_RELOGIO = setInterval(() => { if (typeof painelDeveConsultar !== 'function' || painelDeveConsultar()) vigiarPlanejamentosPendentes(false); }, 3 * 60 * 1000);
  addEventListener('vybe-retomou', () => vigiarPlanejamentosPendentes(true));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) vigiarPlanejamentosPendentes(true); });
}

// Abre uma peça no painel lateral de sempre (Solicitações ou Produção).
function pljAbrirPeca(ref, quadro) {
  const abrir = quadro === 'demandas' ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir === 'function') abrir(String(ref));
}
