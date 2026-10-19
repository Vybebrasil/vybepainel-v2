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
async function carregarPlanejamentosDoCliente(clienteId, nome) {
  const caixa = document.querySelector('#plj-cartao .plj-lista');
  if (!caixa) return;
  if (!clienteId) { caixa.innerHTML = '<p class="plj-vazio">Este cliente ainda não tem cadastro no painel.</p>'; return; }
  try {
    const d = await pljPedir(`cliente_id=${encodeURIComponent(clienteId)}`);
    if (!document.getElementById('plj-cartao')) return;
    if (!d.disponivel) { caixa.innerHTML = '<p class="plj-vazio">Os planejamentos ainda não foram ligados no banco.</p>'; return; }
    const lista = d.planejamentos || [];
    const podeCriar = lista.some((p) => p.pode_editar) || (typeof podeEditarClientes === 'function' && podeEditarClientes());
    caixa.innerHTML = `${lista.length ? `<ul class="plj-meses">${lista.map((p) => `<li>
        <button type="button" class="plj-mes" onclick="abrirPlanejamento('${pljEsc(p.id)}')">
          <b>${pljEsc(pljMes(p.mes))}</b><small>${pljEsc(p.titulo)} · versão ${pljEsc(p.versao)}</small>${pljSelo(p.estado)}</button></li>`).join('')}</ul>`
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
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
      <button type="button" class="workflow-primary" onclick="criarPlanejamento('${pljEsc(clienteId)}', this)">Criar e editar →</button></div>`);
}
async function criarPlanejamento(clienteId, botao) {
  botao.disabled = true;
  try {
    const d = await pljPedir('', { acao: 'criar', cliente_id: clienteId, mes: document.getElementById('plj-novo-mes')?.value,
      titulo: document.getElementById('plj-novo-titulo')?.value, conteudo: {} });
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
  const abas = [['documento', 'Documento'], ...(edita ? [['editar', 'Editar']] : []), ['historico', 'Histórico'], ...(p.pode_editar ? [['identidade', 'Identidade']] : [])];
  const resposta = p.estado === 'ajustes' && p.resposta_texto
    ? `<div class="plj-pedido"><b>${pljEsc(p.resposta_nome || 'O cliente')} pediu ajustes</b><p>${pljEsc(p.resposta_texto)}</p></div>` : '';
  const drive = p.drive_pdf_id || p.drive_doc_id ? `<span class="plj-drive">${p.drive_doc_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://docs.google.com/document/d/${pljEsc(p.drive_doc_id)}/edit">Documento no Drive ↗</a>` : ''}${
    p.drive_pdf_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://drive.google.com/file/d/${pljEsc(p.drive_pdf_id)}/view">PDF ↗</a>` : ''}</span>` : '';
  m.innerHTML = `<div class="workflow-kicker"><span>Planejamento · ${pljEsc(p.cliente)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <div class="plj-topo"><h2 class="workflow-title">${pljEsc(pljMes(p.mes))}</h2>${pljSelo(p.estado)}<small>versão ${pljEsc(p.versao)} · ${p.origem === 'agente' ? 'publicado pelo agente' : 'feito no painel'}</small>${drive}</div>
    ${resposta}
    <div class="plj-abas" role="tablist">${abas.map(([k, r]) => `<button type="button" role="tab" aria-selected="${k === aba}" class="${k === aba ? 'ativa' : ''}" onclick="pljTrocarAba('${k}')">${r}</button>`).join('')}</div>
    <div class="plj-corpo">${aba === 'editar' ? pljEditorHtml() : aba === 'historico' ? pljHistoricoHtml() : aba === 'identidade' ? pljIdentidadeHtml()
      : `<iframe class="plj-previa" title="Documento do planejamento" sandbox="allow-same-origin allow-popups"></iframe>`}</div>
    <div class="workflow-actions plj-acoes">${pljAcoesHtml(aba)}</div>`;
  m.dataset.aba = aba;
  if (aba === 'documento') pljCarregarPrevia(p);
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
function pljTrocarAba(aba) {
  if (document.getElementById('workflow-modal')?.dataset.aba === 'editar') pljColher();
  pintarPlanejamento(aba);
}

function pljAcoesHtml(aba) {
  const p = PLJ_ABERTO;
  if (!p.pode_editar) return '<small class="workflow-hint">Só o head do cliente e quem administra editam e mandam este planejamento.</small>';
  if (aba === 'editar') return `<button type="button" class="workflow-secondary" onclick="pintarPlanejamento('documento')">Descartar</button>
    <button type="button" class="workflow-primary" onclick="salvarPlanejamento(this)">Salvar</button>`;
  if (aba === 'identidade') return `<button type="button" class="workflow-primary" onclick="salvarIdentidadePlanejamento(this)">Salvar identidade</button>`;
  const botoes = [];
  if (['revisar', 'ajustes'].includes(p.estado)) botoes.push(`<button type="button" class="workflow-primary" onclick="confirmarEnvioPlanejamento()">Mandar para o cliente →</button>`);
  if (p.estado === 'enviado') botoes.push(`<button type="button" class="workflow-secondary" onclick="confirmarEnvioPlanejamento()">Gerar um link novo</button>`);
  if (p.estado === 'aprovado') botoes.push(`<button type="button" class="workflow-secondary" onclick="mudarEstadoPlanejamento('revisar')">Reabrir para editar</button>
    <button type="button" class="workflow-primary" onclick="mudarEstadoPlanejamento('cadastrado')">Já cadastrei as peças</button>`);
  return botoes.join('');
}

// ── Editor estruturado: o mesmo formato que o agente usa ─────────────────────
function pljEditorHtml() {
  const c = PLJ_RASCUNHO || {};
  const linha = (k, i, campos) => `<div class="plj-linha" data-lista="${k}">${campos}
    <button type="button" class="plj-tirar" aria-label="Tirar" title="Tirar" onclick="pljTirar('${k}', ${i})">×</button></div>`;
  const ent = (k, v, rot, extra = '') => `<label><span>${rot}</span><input data-k="${k}" type="text" value="${pljEsc(v || '')}" ${extra}></label>`;
  const area = (k, v, rot, linhas = 3) => `<label><span>${rot}</span><textarea data-k="${k}" rows="${linhas}">${pljEsc(v || '')}</textarea></label>`;
  return `<div class="plj-editor">
    <label class="workflow-field"><span>Título</span><input id="plj-titulo" type="text" maxlength="160" value="${pljEsc(PLJ_ABERTO.titulo)}"></label>
    <label class="workflow-field"><span>Visão do mês (para o cliente)</span><textarea id="plj-resumo" rows="3">${pljEsc(c.resumo || '')}</textarea></label>
    <fieldset class="plj-grupo"><legend>Linhas de conteúdo</legend>
      ${(c.linhas || []).map((l, i) => linha('linhas', i, ent('titulo', l.titulo, 'Linha') + area('texto', l.texto, 'O que é', 2))).join('')}
      <button type="button" class="cli-porta" onclick="pljAcrescentar('linhas')">+ Linha</button></fieldset>
    <fieldset class="plj-grupo"><legend>Datas do mês</legend>
      ${(c.datas || []).map((d, i) => linha('datas', i, ent('data', d.data, 'Quando', 'placeholder="02/11 · seg"') + ent('nome', d.nome, 'Data') + ent('texto', d.texto, 'Por que importa'))).join('')}
      <button type="button" class="cli-porta" onclick="pljAcrescentar('datas')">+ Data</button></fieldset>
    <fieldset class="plj-grupo"><legend>Peças (${(c.pecas || []).length})</legend>
      ${(c.pecas || []).map((x, i) => linha('pecas', i, `<label><span>Dia</span><input data-k="data" type="date" value="${pljEsc(x.data || '')}"></label>
        <label><span>Formato</span><select data-k="formato">${PLJ_FORMATOS.map((f) => `<option${f === x.formato ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
        ${ent('tema', x.tema, 'Tema')}${area('legenda', x.legenda, 'Legenda / roteiro', 3)}${ent('referencia', x.referencia, 'Referência')}${ent('observacao', x.observacao, 'Observação')}`)).join('')}
      <button type="button" class="cli-porta" onclick="pljAcrescentar('pecas')">+ Peça</button></fieldset>
    <label class="workflow-field"><span>Observações para o cliente</span><textarea id="plj-obs" rows="3">${pljEsc(c.observacoes || '')}</textarea></label>
    ${PLJ_ABERTO.estado === 'enviado' ? '<p class="workflow-hint">Este planejamento já está com o cliente. Salvar a edição invalida o link anterior; depois é só mandar de novo.</p>' : ''}
  </div>`;
}
function pljColher() {
  const m = document.getElementById('workflow-modal');
  if (!m || !PLJ_RASCUNHO) return;
  const titulo = m.querySelector('#plj-titulo');
  if (titulo) PLJ_ABERTO._titulo = titulo.value;
  PLJ_RASCUNHO.resumo = m.querySelector('#plj-resumo')?.value ?? PLJ_RASCUNHO.resumo;
  PLJ_RASCUNHO.observacoes = m.querySelector('#plj-obs')?.value ?? PLJ_RASCUNHO.observacoes;
  for (const k of ['linhas', 'datas', 'pecas']) {
    PLJ_RASCUNHO[k] = [...m.querySelectorAll(`.plj-linha[data-lista="${k}"]`)].map((el) =>
      Object.fromEntries([...el.querySelectorAll('[data-k]')].map((c) => [c.dataset.k, c.value])));
  }
}
function pljAcrescentar(k) {
  pljColher();
  const novo = { linhas: { titulo: '', texto: '' }, datas: { data: '', nome: '', texto: '' }, pecas: { data: PLJ_ABERTO.mes, formato: 'Card', tema: '', legenda: '', referencia: '', observacao: '' } }[k];
  (PLJ_RASCUNHO[k] ||= []).push(novo);
  pintarPlanejamento('editar');
}
function pljTirar(k, i) {
  pljColher();
  PLJ_RASCUNHO[k].splice(i, 1);
  pintarPlanejamento('editar');
}
async function salvarPlanejamento(botao) {
  pljColher();
  botao.disabled = true;
  try {
    const d = await pljPedir('', { acao: 'editar', id: PLJ_ABERTO.id, versao: PLJ_ABERTO.versao, titulo: PLJ_ABERTO._titulo ?? PLJ_ABERTO.titulo, conteudo: PLJ_RASCUNHO });
    showToast(PLJ_ABERTO.estado === 'enviado' ? 'Salvo. O link antigo deixou de valer; mande de novo quando quiser.' : 'Planejamento salvo.', 'success', 4000);
    await abrirPlanejamento(d.planejamento.id, 'documento');
    pljAtualizarFora();
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 6000); }
}

// ── Histórico e identidade ───────────────────────────────────────────────────
const PLJ_EVENTOS = { publicado: 'Publicado pelo agente', nova_versao: 'Nova versão do agente', editado: 'Editado', enviado: 'Mandado para o cliente',
  aprovado: 'Aprovado pelo cliente', ajustes: 'Cliente pediu ajustes', cadastrado: 'Peças cadastradas', arquivado: 'Arquivado', comentario: 'Comentário', email: 'E-mail' };
function pljHistoricoHtml() {
  const ev = PLJ_ABERTO.eventos || [];
  return `<label class="workflow-field"><span>Comentário para a equipe (o agente também lê)</span>
      <textarea id="plj-comentario" rows="2" maxlength="4000" placeholder="Ex.: trocar a peça do dia 12 por um Reels"></textarea></label>
    <div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="comentarPlanejamento(this)">Comentar</button></div>
    <ol class="plj-historico">${ev.map((e) => `<li><b>${pljEsc(PLJ_EVENTOS[e.tipo] || e.tipo)}</b>
      <small>${pljEsc(pljQuando(e.em))}${e.autor || e.autor_externo ? ' · ' + pljEsc(e.autor || e.autor_externo) : ''}${e.versao ? ' · v' + pljEsc(e.versao) : ''}</small>
      ${e.texto ? `<p>${pljEsc(e.texto)}</p>` : ''}</li>`).join('') || '<li class="plj-vazio">Sem histórico ainda.</li>'}</ol>`;
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
  return `<p class="workflow-copy">A estrutura do documento é a mesma para todos os clientes; isto aqui dá a cara de cada um. Vale para todos os planejamentos deste cliente.</p>
    <div class="plj-identidade">
      <label class="workflow-field"><span>Cor principal</span><input id="plj-cor" type="color" value="${pljEsc(i.cor || '#ff7a00')}"></label>
      <label class="workflow-field"><span>Cor de apoio</span><input id="plj-cor-apoio" type="color" value="${pljEsc(i.cor_apoio || '#1d2227')}"></label>
      <label class="workflow-field"><span>Logo (endereço https da imagem)</span><input id="plj-logo" type="url" value="${pljEsc(i.logo || '')}" placeholder="https://…/logo.png"></label>
      <label class="workflow-field"><span>Fonte (nome do Google Fonts)</span><input id="plj-fonte" type="text" value="${pljEsc(i.fonte || '')}" placeholder="Ex.: Montserrat"></label>
      <label class="workflow-field"><span>Tom de voz (para o agente)</span><textarea id="plj-tom" rows="2" maxlength="400">${pljEsc(i.tom || '')}</textarea></label>
    </div>`;
}
async function salvarIdentidadePlanejamento(botao) {
  botao.disabled = true;
  const v = (id) => document.getElementById(id)?.value || '';
  try {
    const d = await pljPedir('', { acao: 'identidade', cliente_id: PLJ_ABERTO.cliente_id, cor: v('plj-cor'), cor_apoio: v('plj-cor-apoio'), logo: v('plj-logo'), fonte: v('plj-fonte'), tom: v('plj-tom') });
    PLJ_ABERTO.identidade = d.identidade;
    showToast('Identidade salva. O documento já sai com ela.', 'success');
    pintarPlanejamento('documento');
  } catch (e) { botao.disabled = false; showToast(e.message, 'error', 5000); }
}

// ── Mandar para o cliente ───────────────────────────────────────────────────
function confirmarEnvioPlanejamento() {
  const acoes = document.querySelector('#workflow-modal .plj-acoes');
  if (!acoes) return;
  acoes.innerHTML = `<label class="plj-check"><input id="plj-email" type="checkbox" checked> Mandar cópia para o e-mail do cliente</label>
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
    const texto = `Olá! Segue o planejamento de conteúdo de ${pljMes(PLJ_ABERTO.mes).toLowerCase()} para você aprovar: ${d.link}`;
    const m = document.getElementById('workflow-modal');
    m?.querySelector('.plj-topo')?.insertAdjacentHTML('afterend', `<div class="plj-link">
      <b>Link pronto. Mande para o cliente no WhatsApp:</b>
      <div class="plj-link-linha"><input type="text" readonly value="${pljEsc(d.link)}" aria-label="Link de aprovação" onclick="this.select()">
        <button type="button" class="cli-porta" onclick="pljCopiar(this, '${pljEsc(d.link)}')">Copiar</button>
        <a class="cli-porta" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Abrir no WhatsApp ↗</a></div>
      <small>O link vale 30 dias. Se você editar o planejamento, ele deixa de valer.</small>
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
  } catch { return; }
  pintarAvisoPlanejamentos();
  if (typeof escritorioPlanejamentosPendentes === 'function') escritorioPlanejamentosPendentes(PLJ_PENDENTES);
}
function pintarAvisoPlanejamentos() {
  let el = document.getElementById('plj-aviso');
  if (!PLJ_PENDENTES.length) { el?.remove(); return; }
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
  el.innerHTML = `<span class="plj-aviso-ponto" aria-hidden="true"></span><span><b>${n} planejamento${n > 1 ? 's' : ''} esperando você</b>
    <small>${ajustes ? `${ajustes} com ajustes do cliente · ` : ''}${pljEsc([...new Set(PLJ_PENDENTES.map((p) => p.cliente))].slice(0, 3).join(', '))}</small></span>`;
}
function abrirPendentesPlanejamento() {
  openWorkflowModal(`<div class="workflow-kicker"><span>Planejamentos · Centro de Operação</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <h2 class="workflow-title">Esperando você</h2>
    <p class="workflow-copy">Planejamentos dos seus clientes para revisar e mandar, ou com ajustes pedidos pelo cliente.</p>
    <ul class="plj-meses">${PLJ_PENDENTES.map((p) => `<li><button type="button" class="plj-mes" onclick="abrirPlanejamento('${pljEsc(p.id)}')">
      <b>${pljEsc(p.cliente)}</b><small>${pljEsc(pljMes(p.mes))} · ${pljEsc(p.titulo)}</small>${pljSelo(p.estado)}</button></li>`).join('')}</ul>
    ${typeof irParaSalaEscritorio === 'function' ? `<div class="workflow-actions"><button type="button" class="workflow-secondary" onclick="closeWorkflowModal();irParaSalaEscritorio('operacao')">Ir ao Centro de Operação</button></div>` : ''}`);
}
function iniciarVigiaPlanejamentos() {
  if (PLJ_RELOGIO) return;
  vigiarPlanejamentosPendentes(true);
  PLJ_RELOGIO = setInterval(() => vigiarPlanejamentosPendentes(false), 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) vigiarPlanejamentosPendentes(true); });
}
