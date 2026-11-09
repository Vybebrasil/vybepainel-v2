// Impressões da Produção (Paulo, 09/11/2026: um botão "Impressões" perto de Fornecedores e ligado a eles).
// Cada impressão anda por etapas (arte → orçamento → aprovado → arquivo enviado → em impressão → pronto → entregue)
// com a gráfica (fornecedor), a arte na esteira (conteudo_id, abre como vybe:<id>) e o histórico de cada passo.
// Servidor: /api/painel?area=impressoes (server/impressoes.js). Regras ficam lá: sem fornecedor não vai para a gráfica,
// cancelar pede nota, pedido e entrega datam sozinhos, a arte pronta na esteira leva a impressão para orçamento.
// API: window.VybeImpressoes = { abrir(_, { fornecedor }), fechar(), aberto() }
(() => {
  'use strict';
  const URL_API = '/api/painel?area=impressoes';
  const st = { raiz: null, janela: null, antes: null, dados: null, erro: '', carregando: false, sel: '', form: null, cancelar: false, aviso: '', filtro: '', fornecedor: '' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const br = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const cli = (nome) => (nome ? (typeof window.cliCor === 'function' ? window.cliCor(nome) : esc(nome)) : '');
  const statusDemanda = (s) => (s ? (typeof window.statusCor === 'function' ? window.statusCor({ status: s }) : esc(s)) : '');
  const reais = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const estado = (tipo, titulo, texto, acao = '') => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo, titulo, texto, acao })
    : `<div class="vi-vazio"><b>${esc(titulo)}</b><p>${esc(texto)}</p>${acao}</div>`);
  const etapaNome = (id) => st.dados?.etapas?.find((e) => e.id === id)?.nome || id;
  const ABERTAS = (i) => !['entregue', 'cancelado'].includes(i.etapa);

  async function pedir(metodo, corpo) {
    const r = await fetch(URL_API, { method: metodo, credentials: 'same-origin', cache: 'no-store',
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined });
    let d = {}; try { d = await r.json(); } catch { /* sem corpo */ }
    if (!r.ok) throw Object.assign(new Error(d.error || 'Não foi possível falar com o servidor.'), { status: r.status });
    return d;
  }
  async function carregar() {
    st.carregando = true; st.erro = ''; pintar();
    try { st.dados = await pedir('GET'); } catch (e) { st.erro = e.message; } finally { st.carregando = false; pintar(); }
  }
  async function gravar(corpo, sucesso) {
    st.aviso = 'Salvando…'; pintarAviso();
    try {
      const r = await pedir('POST', corpo);
      st.aviso = r.arte_id ? `${sucesso} A arte foi para Solicitações como demanda.` : sucesso;
      st.form = null; st.cancelar = false;
      if (r.id) st.sel = String(r.id);
      await carregar();
    } catch (e) { st.aviso = e.message; pintarAviso(true); }
  }

  // ---------- desenho ----------
  const visiveis = () => (st.dados?.impressoes || []).filter((i) => (!st.fornecedor || String(i.fornecedor_id) === st.fornecedor)
    && (st.filtro === 'atrasadas' ? i.atrasada : st.filtro === 'semfornecedor' ? !i.fornecedor_id && ABERTAS(i) : true));
  function cartao(i) {
    return `<button type="button" class="vi-cartao${i.atrasada ? ' atrasada' : ''}${String(i.id) === st.sel ? ' sel' : ''}" data-vi-abrir="${esc(i.id)}">
      <b>${esc(i.titulo)}</b>
      <span class="vi-linha">${cli(i.cliente_nome) || '<em class="vi-mudo">sem cliente</em>'}</span>
      <span class="vi-linha">${i.fornecedor_nome ? esc(i.fornecedor_nome) : '<em class="vi-tag ruim">sem fornecedor</em>'}</span>
      <span class="vi-pe">${[i.material, i.quantidade ? `${Number(i.quantidade).toLocaleString('pt-BR')} un.` : ''].filter(Boolean).map(esc).join(' · ')}
        ${i.previsao ? `<time class="${i.atrasada ? 'atrasada' : ''}">${i.atrasada ? 'atrasada · ' : ''}${br(i.previsao)}</time>` : ''}</span>
      ${i.conteudo_id && i.etapa === 'arte' ? `<span class="vi-linha">${statusDemanda(i.demanda_status || 'Na esteira')}</span>` : ''}
    </button>`;
  }
  function quadro() {
    const lista = visiveis(), etapas = (st.dados.etapas || []).filter((e) => e.id !== 'cancelado');
    const canceladas = lista.filter((i) => i.etapa === 'cancelado').length;
    return `<div class="vi-quadro" role="list">${etapas.map((e) => { const l = lista.filter((i) => i.etapa === e.id);
      return `<section class="vi-coluna" role="listitem" aria-label="${esc(e.nome)}"><div class="vi-coluna-topo"><b>${esc(e.nome)}</b><em>${l.length}</em></div>
        ${l.map(cartao).join('') || '<p class="vi-mudo">Nada aqui.</p>'}</section>`; }).join('')}</div>
      ${canceladas ? `<p class="vi-nota">${canceladas} cancelada${canceladas > 1 ? 's' : ''} nos últimos 90 dias.</p>` : ''}`;
  }
  function ficha() {
    const i = (st.dados.impressoes || []).find((x) => String(x.id) === st.sel); if (!i) return '';
    const etapas = st.dados.etapas || [], k = etapas.findIndex((e) => e.id === i.etapa), prox = ABERTAS(i) ? etapas[k + 1] : null;
    const precisaForn = (id) => ['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(id) && !i.fornecedor_id;
    return `<aside class="vi-ficha" aria-label="Impressão ${esc(i.titulo)}">
      <div class="vi-ficha-topo"><span><small>${esc(etapaNome(i.etapa))}${i.atrasada ? ' · <b class="t-ruim">atrasada</b>' : ''}</small><h3>${esc(i.titulo)}</h3></span>
        <button type="button" class="vi-x" data-vi="fechar-ficha" aria-label="Fechar a ficha">✕</button></div>
      <dl class="vi-dados">
        <dt>Cliente</dt><dd>${cli(i.cliente_nome) || 'interno'}${i.projeto_nome ? ` · ${esc(i.projeto_nome)}` : ''}</dd>
        <dt>Fornecedor</dt><dd>${i.fornecedor_nome ? esc(i.fornecedor_nome) : '<em class="vi-tag ruim">sem fornecedor</em>'}</dd>
        <dt>Material</dt><dd>${esc([i.material, i.quantidade ? `${Number(i.quantidade).toLocaleString('pt-BR')} un.` : ''].filter(Boolean).join(' · ') || '—')}</dd>
        ${i.especificacao ? `<dt>Especificação</dt><dd>${esc(i.especificacao)}</dd>` : ''}
        <dt>Previsão</dt><dd>${i.previsao ? br(i.previsao) : '—'}${i.pedido_em ? ` · pedido em ${br(i.pedido_em)}` : ''}${i.entregue_em ? ` · entregue em ${br(i.entregue_em)}` : ''}</dd>
        <dt>Responsável</dt><dd>${esc(i.responsavel_nome || '—')}</dd>
        ${i.valor != null ? `<dt>Valor</dt><dd>${reais(i.valor)}</dd>` : ''}
        ${i.arquivo_url ? `<dt>Arquivo</dt><dd><a href="${esc(i.arquivo_url)}" target="_blank" rel="noopener">abrir o arquivo ↗</a></dd>` : ''}
        ${i.conteudo_id ? `<dt>Arte</dt><dd><button type="button" class="vi-link" data-vi-arte="${esc(i.conteudo_id)}">${statusDemanda(i.demanda_status || 'Na esteira')} abrir a arte</button></dd>` : ''}
        ${i.observacao ? `<dt>Observação</dt><dd>${esc(i.observacao)}</dd>` : ''}
      </dl>
      ${ABERTAS(i) ? `<div class="vi-acoes">
        ${prox ? `<button type="button" class="vi-botao principal" data-vi-etapa="${esc(prox.id)}"${precisaForn(prox.id) ? ' disabled title="Escolha o fornecedor antes"' : ''}>Avançar para ${esc(prox.nome)}</button>` : ''}
        <label class="vi-mover"><span>Mover para</span><select data-vi-mover><option value="">Escolha…</option>${etapas.filter((e) => e.id !== i.etapa && e.id !== 'cancelado').map((e) => `<option value="${esc(e.id)}"${precisaForn(e.id) ? ' disabled' : ''}>${esc(e.nome)}</option>`).join('')}</select></label>
        <button type="button" class="vi-botao" data-vi="editar">Editar</button>
        <button type="button" class="vi-botao perigo" data-vi="cancelar">Cancelar</button>
      </div>
      ${!i.fornecedor_id ? '<p class="vi-nota">Sem fornecedor a impressão não vai para a gráfica. Escolha em Editar.</p>' : ''}
      ${st.cancelar ? `<form class="vi-cancelar" data-vi-form="cancelar"><label><span>Por que cancelar? (fica no histórico)</span><textarea name="nota" required maxlength="500" rows="2"></textarea></label>
        <div class="vi-acoes"><button type="submit" class="vi-botao perigo">Cancelar a impressão</button><button type="button" class="vi-botao" data-vi="nao-cancelar">Voltar</button></div></form>` : ''}` : ''}
      <h4>Histórico</h4>
      <ol class="vi-hist">${(i.eventos || []).slice().reverse().map((ev) => `<li><b>${ev.de ? `${esc(etapaNome(ev.de))} → ` : ''}${esc(etapaNome(ev.para))}</b><small>${esc([ev.autor_nome, ev.em ? new Date(ev.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''].filter(Boolean).join(' · '))}</small>${ev.nota ? `<p>${esc(ev.nota)}</p>` : ''}</li>`).join('') || '<li class="vi-mudo">Sem registros.</li>'}</ol>
    </aside>`;
  }
  function formulario() {
    const d = st.dados, f = st.form || {}, novo = !f.id;
    const op = (lista, v, vazio, rot = (x) => x.nome) => `<option value="">${esc(vazio)}</option>${(lista || []).map((x) => `<option value="${esc(x.id)}"${String(x.id) === String(v ?? '') ? ' selected' : ''}>${esc(rot(x))}</option>`).join('')}`;
    const projetos = (d.projetos || []).filter((p) => !f.cliente_id || !p.cliente_id || String(p.cliente_id) === String(f.cliente_id));
    return `<form class="vi-form" data-vi-form="impressao">
      <h3>${novo ? 'Nova impressão' : 'Editar impressão'}</h3>
      <div class="vi-grade">
        <label class="largo"><span>O que imprimir</span><input name="titulo" required maxlength="200" value="${esc(f.titulo || '')}" placeholder="Ex.: Adesivo da vitrine"></label>
        <label><span>Cliente</span><select name="cliente_id" data-vi-cliente>${op(d.clientes, f.cliente_id, 'Interno (sem cliente)')}</select></label>
        <label><span>Projeto pontual</span><select name="projeto_id">${op(projetos, f.projeto_id, 'Sem projeto')}</select></label>
        <label><span>Fornecedor (gráfica)</span>${(d.fornecedores || []).length ? `<select name="fornecedor_id">${op(d.fornecedores, f.fornecedor_id, 'Ainda sem fornecedor', (x) => x.categoria ? `${x.nome} · ${x.categoria}` : x.nome)}</select>`
          : '<span class="vi-sem-forn">Nenhum fornecedor cadastrado. <button type="button" class="vi-link" data-vi="cadastrar-fornecedor">Cadastrar fornecedor</button></span>'}</label>
        <label><span>Responsável</span><select name="responsavel">${op(d.pessoas, f.responsavel, 'Sem responsável')}</select></label>
        <label><span>Material</span><input name="material" maxlength="120" value="${esc(f.material || '')}" placeholder="Adesivo vinil, lona, papel couchê…"></label>
        <label><span>Quantidade</span><input name="quantidade" type="number" min="0" step="1" value="${esc(f.quantidade ?? '')}"></label>
        <label><span>Previsão de entrega</span><input name="previsao" type="date" value="${esc(f.previsao || '')}"></label>
        ${d.gestao ? `<label><span>Valor (R$)</span><input name="valor" type="number" min="0" step="0.01" value="${esc(f.valor ?? '')}"></label>` : ''}
        <label class="largo"><span>Especificação</span><textarea name="especificacao" rows="2" maxlength="1000" placeholder="Tamanho, acabamento, cores…">${esc(f.especificacao || '')}</textarea></label>
        <label class="largo"><span>Link do arquivo (https)</span><input name="arquivo_url" type="url" maxlength="500" value="${esc(f.arquivo_url || '')}" placeholder="https://drive.google.com/…"></label>
        <label class="largo"><span>Observação</span><textarea name="observacao" rows="2" maxlength="1000">${esc(f.observacao || '')}</textarea></label>
        ${novo ? `<label class="largo vi-check"><input type="checkbox" name="criar_arte"${f.criar_arte === false ? '' : ' checked'}><span>Com cliente e sem arte: criar a arte em Solicitações (a impressão anda sozinha quando a arte terminar)</span></label>` : ''}
      </div>
      <div class="vi-acoes"><button type="submit" class="vi-botao principal">${novo ? 'Criar impressão' : 'Salvar'}</button><button type="button" class="vi-botao" data-vi="fechar-form">Cancelar</button></div>
    </form>`;
  }
  function porFornecedor() {
    const l = st.dados.porFornecedor || []; if (!l.length) return '';
    return `<section class="vi-bloco"><h4>Por fornecedor</h4><ul class="vi-forn">${l.map((f) => `<li><button type="button" data-vi-fornecedor="${esc(f.fornecedor_id)}" aria-pressed="${String(f.fornecedor_id) === st.fornecedor}"><b>${esc(f.nome)}</b>
      <small>${f.abertas} aberta${f.abertas === 1 ? '' : 's'}${f.atrasadas ? ` · <span class="t-ruim">${f.atrasadas} atrasada${f.atrasadas === 1 ? '' : 's'}</span>` : ''} · ${f.entregues} entregue${f.entregues === 1 ? '' : 's'}${f.prazo_medio_dias != null ? ` · ${String(f.prazo_medio_dias).replace('.', ',')} d em média` : ''}</small></button></li>`).join('')}</ul></section>`;
  }
  function corpo() {
    if (!st.dados && !st.erro) return estado('carregando', 'Carregando as impressões', '');
    if (st.erro && !st.dados) return estado('erro', 'Não deu para abrir Impressões', st.erro, '<button type="button" class="vi-botao" data-vi="recarregar">Tentar de novo</button>');
    const d = st.dados, R = d.resumo || {};
    const semForn = !(d.fornecedores || []).length;
    const chip = (k, rot, n, cls = '') => `<button type="button" class="vi-chip ${cls}" data-vi-filtro="${k}" aria-pressed="${st.filtro === k}">${rot}${n != null ? ` <em>${n}</em>` : ''}</button>`;
    const fNome = st.fornecedor ? (d.fornecedores || []).find((f) => String(f.id) === st.fornecedor)?.nome || 'fornecedor' : '';
    return `${semForn ? `<div class="vi-alerta"><span><b>Nenhum fornecedor cadastrado.</b> Sem a gráfica, a impressão não sai do orçamento. Cadastre a primeira e ela aparece aqui.</span>
        <button type="button" class="vi-botao" data-vi="cadastrar-fornecedor">Cadastrar fornecedor</button></div>` : ''}
      <div class="vi-filtros" role="group" aria-label="Filtrar">${chip('', 'Abertas', R.abertas)}${chip('atrasadas', 'Atrasadas', R.atrasadas, R.atrasadas ? 'ruim' : '')}${chip('semfornecedor', 'Sem fornecedor', R.semFornecedor, R.semFornecedor ? 'atencao' : '')}
        ${fNome ? `<button type="button" class="vi-chip" data-vi-fornecedor="" aria-pressed="true">${esc(fNome)} ✕</button>` : ''}</div>
      ${st.form ? formulario() : ''}
      <div class="vi-meio${st.sel ? ' com-ficha' : ''}">${(d.impressoes || []).length ? quadro() : estado('vazio', 'Nenhuma impressão ainda', 'Adesivo, banner, cardápio, embalagem: cadastre o que vai para a gráfica e acompanhe até a entrega.', '<button type="button" class="vi-botao principal" data-vi="nova">Nova impressão</button>')}${ficha()}</div>
      ${porFornecedor()}`;
  }
  function pintar() {
    if (!st.janela) return;
    const tinha = st.janela.querySelector('.vi-corpo')?.scrollTop || 0;
    st.janela.innerHTML = `<div class="vi-topo"><span><small>Produção</small><h2 id="vi-titulo">Impressões</h2><p>Da arte à entrega na gráfica: etapa, fornecedor, prazo e histórico de cada peça impressa.</p></span>
      <span class="vi-topo-acoes">${st.dados && (st.dados.impressoes || []).length && !st.form ? '<button type="button" class="vi-botao principal" data-vi="nova">Nova impressão</button>' : ''}<button type="button" class="vi-x" data-vi="fechar" aria-label="Fechar">✕</button></span></div>
      <p class="vi-aviso" role="status"></p><div class="vi-corpo">${corpo()}</div>`;
    pintarAviso();
    const c = st.janela.querySelector('.vi-corpo'); if (c) c.scrollTop = tinha;
  }
  function pintarAviso(erro = false) { const a = st.janela?.querySelector('.vi-aviso'); if (a) { a.textContent = st.aviso; a.classList.toggle('erro', erro); } }

  // ---------- eventos ----------
  const formParaObjeto = (form) => {
    const o = Object.fromEntries(new FormData(form).entries());
    if (form.querySelector('[name=criar_arte]')) o.criar_arte = form.querySelector('[name=criar_arte]').checked;
    for (const k of ['cliente_id', 'projeto_id', 'fornecedor_id', 'responsavel']) if (o[k] === '') o[k] = null;
    for (const k of ['quantidade', 'valor']) o[k] = o[k] === '' || o[k] == null ? null : Number(o[k]);
    if (o.previsao === '') o.previsao = null;
    return o;
  };
  function cadastrarFornecedor() {
    // O cadastro é o mesmo de Fornecedores (Comercial); volta-se a Impressões pelo dock.
    fechar();
    window.VybeComercial?.abrir?.('fornecedores', { abas: ['fornecedores', 'creators'], rotulo: 'Produção' });
  }
  function aoClicar(e) {
    if (e.target === st.raiz) { fechar(); return; }
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.viAbrir) { st.sel = b.dataset.viAbrir; st.cancelar = false; pintar(); return; }
    if (b.dataset.viFiltro !== undefined) { st.filtro = b.dataset.viFiltro; pintar(); return; }
    if (b.dataset.viFornecedor !== undefined) { st.fornecedor = st.fornecedor === b.dataset.viFornecedor ? '' : b.dataset.viFornecedor; pintar(); return; }
    if (b.dataset.viArte) { const id = String(b.dataset.viArte); window.openItemWorkspace?.(id.startsWith('vybe:') ? id : 'vybe:' + id); return; }
    if (b.dataset.viEtapa) { gravar({ acao: 'impressao_etapa', id: st.sel, etapa: b.dataset.viEtapa }, `Foi para ${etapaNome(b.dataset.viEtapa)}.`); return; }
    const a = b.dataset.vi;
    if (a === 'fechar') fechar();
    else if (a === 'recarregar') carregar();
    else if (a === 'nova') { st.form = { criar_arte: true }; st.sel = ''; pintar(); st.janela.querySelector('[name=titulo]')?.focus(); }
    else if (a === 'editar') { const i = st.dados.impressoes.find((x) => String(x.id) === st.sel); st.form = { ...i }; pintar(); st.janela.querySelector('[name=titulo]')?.focus(); }
    else if (a === 'fechar-form') { st.form = null; pintar(); }
    else if (a === 'fechar-ficha') { st.sel = ''; st.cancelar = false; pintar(); }
    else if (a === 'cancelar') { st.cancelar = true; pintar(); st.janela.querySelector('[data-vi-form=cancelar] textarea')?.focus(); }
    else if (a === 'nao-cancelar') { st.cancelar = false; pintar(); }
    else if (a === 'cadastrar-fornecedor') cadastrarFornecedor();
  }
  function aoMudar(e) {
    const m = e.target.closest('[data-vi-mover]'); if (m) { const para = m.value; m.value = ''; if (para) gravar({ acao: 'impressao_etapa', id: st.sel, etapa: para }, `Foi para ${etapaNome(para)}.`); return; }
    const c = e.target.closest('[data-vi-cliente]'); if (c && st.form) { const f = e.target.form; st.form = { ...st.form, ...formParaObjeto(f), cliente_id: c.value || null, projeto_id: null }; pintar(); }
  }
  function aoEnviar(e) {
    const form = e.target.closest('[data-vi-form]'); if (!form) return; e.preventDefault();
    if (form.dataset.viForm === 'cancelar') { const nota = String(new FormData(form).get('nota') || '').trim(); if (!nota) return; gravar({ acao: 'impressao_etapa', id: st.sel, etapa: 'cancelado', nota }, 'Impressão cancelada.'); return; }
    const o = formParaObjeto(form), id = st.form?.id;
    gravar({ acao: 'impressao_salvar', ...(id ? { id } : {}), ...o }, id ? 'Impressão salva.' : 'Impressão criada.');
  }
  function aoTeclar(e) {
    if (!st.raiz || e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('dialog[open], #workspace-drawer.open')) return;
    e.preventDefault(); e.stopPropagation();
    if (st.form) { st.form = null; pintar(); } else if (st.sel) { st.sel = ''; pintar(); } else fechar();
  }

  function abrir(_aba, opcoes = {}) {
    st.fornecedor = opcoes.fornecedor ? String(opcoes.fornecedor) : '';
    if (!st.raiz) {
      st.antes = document.activeElement || null;
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vc-camada vi-camada';
      janela.id = 'vv-impressoes'; janela.className = 'vc-janela';
      janela.setAttribute('role', 'dialog'); janela.setAttribute('aria-modal', 'true'); janela.setAttribute('aria-labelledby', 'vi-titulo');
      raiz.append(janela);
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('change', aoMudar); raiz.addEventListener('submit', aoEnviar);
      document.body.append(raiz);
      Object.assign(st, { raiz, janela });
    }
    pintar(); carregar();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '', form: null, sel: '', cancelar: false });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  window.VybeImpressoes = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz) });
})();
