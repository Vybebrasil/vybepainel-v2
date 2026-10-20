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
  const abas = [['documento', 'Documento'], ...(edita ? [['editar', 'Editar']] : []), ['historico', 'Histórico'], ...(p.pode_editar ? [['identidade', 'Marca do cliente']] : [])];
  const resposta = p.estado === 'ajustes' && p.resposta_texto
    ? `<div class="plj-pedido"><b>${pljEsc(p.resposta_nome || 'O cliente')} pediu ajustes</b><p>${pljEsc(p.resposta_texto)}</p><small>As peças com pedido aparecem marcadas na aba Editar.</small></div>` : '';
  const drive = p.drive_pdf_id || p.drive_doc_id ? `<span class="plj-drive">${p.drive_doc_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://docs.google.com/document/d/${pljEsc(p.drive_doc_id)}/edit">Documento no Drive ↗</a>` : ''}${
    p.drive_pdf_id ? `<a class="cli-porta" target="_blank" rel="noopener" href="https://drive.google.com/file/d/${pljEsc(p.drive_pdf_id)}/view">PDF ↗</a>` : ''}</span>` : '';
  m.innerHTML = `<div class="workflow-kicker"><span>Planejamento · ${pljEsc(p.cliente)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
    <div class="plj-topo"><h2 class="workflow-title">${pljEsc(pljMes(p.mes))}</h2>${pljSelo(p.estado)}<small>versão ${pljEsc(p.versao)} · ${p.origem === 'agente' ? 'publicado pelo agente' : 'feito no painel'}</small>${drive}</div>
    ${pljEtapasHtml(p)}${resposta}${pljDemandasCriadasHtml(p)}
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
  if (aba === 'identidade') return `<button type="button" class="workflow-primary" onclick="salvarIdentidadePlanejamento(this)">Salvar marca</button>`;
  const botoes = [];
  if (['revisar', 'ajustes'].includes(p.estado)) botoes.push(`<button type="button" class="workflow-primary" onclick="confirmarEnvioPlanejamento()">Mandar para o cliente →</button>`);
  if (p.estado === 'enviado') botoes.push(`<button type="button" class="workflow-secondary" onclick="confirmarEnvioPlanejamento()">Gerar um link novo</button>`);
  if (p.estado === 'aprovado') botoes.push(`<button type="button" class="workflow-secondary" onclick="mudarEstadoPlanejamento('revisar')">Reabrir para editar</button>
    <button type="button" class="workflow-secondary" onclick="mudarEstadoPlanejamento('cadastrado')">Já cadastrei à mão</button>
    <button type="button" class="workflow-primary" onclick="confirmarCadastroPlanejamento()">Cadastrar as ${(p.conteudo?.pecas || []).length} peças →</button>`);
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
      <p class="workflow-hint">Clique numa peça para abrir. As com pedido do cliente vêm marcadas.</p>
      ${(c.pecas || []).map((x, i) => pljPecaEditorHtml(x, i)).join('')}
      <button type="button" class="cli-porta" onclick="pljAcrescentar('pecas')">+ Peça</button></fieldset>
    <label class="workflow-field"><span>Observações para o cliente</span><textarea id="plj-obs" rows="3">${pljEsc(c.observacoes || '')}</textarea></label>
    ${PLJ_ABERTO.estado === 'enviado' ? '<p class="workflow-hint">Este planejamento já está com o cliente. Salvar a edição invalida o link anterior; depois é só mandar de novo.</p>' : ''}
  </div>`;
}
// Uma peça no editor: um cartão que abre e fecha, com o resumo na linha de
// cima (Paulo, 20/10/2026: "melhorar a forma como edita").
function pljPecaEditorHtml(x, i) {
  const dia = x.data ? `${x.data.slice(8, 10)}/${x.data.slice(5, 7)}` : 'sem dia';
  const ent = (k, v, rot) => `<label><span>${rot}</span><input data-k="${k}" type="text" value="${pljEsc(v || '')}"></label>`;
  const area = (k, v, rot, linhas) => `<label><span>${rot}</span><textarea data-k="${k}" rows="${linhas}">${pljEsc(v || '')}</textarea></label>`;
  return `<details class="plj-linha plj-peca${x.ajuste_cliente ? ' com-pedido' : ''}" data-lista="pecas"${x.ajuste_cliente ? ' open' : ''}>
    <summary><span class="plj-peca-num">${String(i + 1).padStart(2, '0')}</span><span class="plj-peca-tag f-${pljEsc(x.formato || 'Card').normalize('NFD').replace(/[^A-Za-z]/g, '')}">${pljEsc(x.formato || 'Card')}</span><span class="plj-peca-dia">${pljEsc(dia)}</span><b>${pljEsc(x.tema || 'Sem tema')}</b>${x.ajuste_cliente ? '<em>pedido do cliente</em>' : ''}</summary>
    ${x.ajuste_cliente ? `<div class="plj-pedido"><b>O cliente pediu</b><p>${pljEsc(x.ajuste_cliente)}</p></div>` : ''}
    <div class="plj-peca-campos">
      <label><span>Dia</span><input data-k="data" type="date" value="${pljEsc(x.data || '')}"></label>
      <label><span>Formato</span><select data-k="formato">${PLJ_FORMATOS.map((f) => `<option${f === x.formato ? ' selected' : ''}>${f}</option>`).join('')}</select></label>
      ${ent('tema', x.tema, 'Tema')}
    </div>
    ${area('legenda', x.legenda, ['Reels', 'Vídeo'].includes(x.formato) ? 'Roteiro' : 'Legenda', 6)}
    ${area('referencia', x.referencia, 'Referência e texto das telas', 4)}
    ${area('observacao', x.observacao, 'Para o cliente decidir', 2)}
    <input type="hidden" data-k="ajuste_cliente" value="${pljEsc(x.ajuste_cliente || '')}">${x.conteudo_id ? `<input type="hidden" data-k="conteudo_id" value="${pljEsc(x.conteudo_id)}">` : ''}
    <div class="plj-peca-rodape"><button type="button" class="plj-tirar-texto" onclick="pljTirar('pecas', ${i})">Tirar esta peça</button></div>
  </details>`;
}
// Etapas no topo: onde o planejamento está e o que vem agora.
function pljEtapasHtml(p) {
  const ordem = ['revisar', 'enviado', 'aprovado', 'cadastrado'];
  const atual = p.estado === 'ajustes' ? 0 : Math.max(0, ordem.indexOf(p.estado));
  const nomes = ['Revisar', 'Com o cliente', 'Aprovado', 'Cadastrado'];
  const proximo = { revisar: 'Revise e mande para o cliente.', ajustes: 'O cliente pediu ajustes: corrija e mande de novo.', enviado: 'Esperando a resposta do cliente pelo link.', aprovado: 'Aprovado: cadastre as peças.', cadastrado: 'Peças cadastradas no painel.' }[p.estado] || '';
  return `<div class="plj-etapas" aria-label="Etapas do planejamento"><ol>${nomes.map((n, i) => `<li class="${i < atual ? 'feita' : i === atual ? 'agora' : ''}${i === 0 && p.estado === 'ajustes' ? ' ajustes' : ''}"><i>${i < atual ? '✓' : i + 1}</i><span>${i === 0 && p.estado === 'ajustes' ? 'Ajustar' : n}</span></li>`).join('')}</ol><small>${pljEsc(proximo)}</small></div>`;
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
      <div class="plj-logo-previa" id="plj-logo-previa">${i.logo ? `<img src="${pljEsc(i.logo)}" alt="Logo do cliente">` : '<small>Sem logo: a capa mostra o nome do cliente.</small>'}</div>
      <label class="workflow-field"><span>Tom de voz (para o agente)</span><textarea id="plj-tom" rows="3" maxlength="400">${pljEsc(i.tom || '')}</textarea></label>
    </div>`;
}
function pljPreverLogo(v) {
  const el = document.getElementById('plj-logo-previa');
  if (el) el.innerHTML = /^https:\/\/\S{4,500}$/.test(v) ? `<img src="${pljEsc(v)}" alt="Logo do cliente" onerror="this.replaceWith(Object.assign(document.createElement('small'),{textContent:'Não deu para abrir essa imagem.'}))">` : '<small>Sem logo: a capa mostra o nome do cliente.</small>';
}
async function salvarIdentidadePlanejamento(botao) {
  botao.disabled = true;
  const v = (id) => document.getElementById(id)?.value || '';
  try {
    const d = await pljPedir('', { acao: 'identidade', cliente_id: PLJ_ABERTO.cliente_id, logo: v('plj-logo'), tom: v('plj-tom') });
    PLJ_ABERTO.identidade = d.identidade;
    showToast('Salvo. O documento já sai com o logo.', 'success');
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
    // O cliente aprova pelo VybeHub dele (Paulo, 20/10/2026); o link direto
    // continua para quem não entrou no portal.
    const portal = typeof ESCRITORIO_VYBEHUB !== 'undefined' && typeof escritorioSlugCliente === 'function'
      ? `${ESCRITORIO_VYBEHUB}/cliente/${escritorioSlugCliente(PLJ_ABERTO.cliente)}/planejamentos` : '';
    const texto = portal
      ? `Olá! O planejamento de conteúdo de ${pljMes(PLJ_ABERTO.mes).toLowerCase()} está no seu VybeHub para aprovar: ${portal}\n\nSe preferir, aprove direto por aqui: ${d.link}`
      : `Olá! Segue o planejamento de conteúdo de ${pljMes(PLJ_ABERTO.mes).toLowerCase()} para você aprovar: ${d.link}`;
    const m = document.getElementById('workflow-modal');
    m?.querySelector('.plj-topo')?.insertAdjacentHTML('afterend', `<div class="plj-link">
      <b>Link pronto. Mande para o cliente no WhatsApp:</b>
      <div class="plj-link-linha"><input type="text" readonly value="${pljEsc(d.link)}" aria-label="Link de aprovação" onclick="this.select()">
        <button type="button" class="cli-porta" onclick="pljCopiar(this, '${pljEsc(d.link)}')">Copiar</button>
        <a class="cli-porta" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Abrir no WhatsApp ↗</a></div>
      ${portal ? `<small>A mensagem do WhatsApp leva o cliente ao VybeHub dele (${pljEsc(portal.replace(/^https:\/\//, ''))}) e traz o link direto como reserva.</small>` : ''}
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
