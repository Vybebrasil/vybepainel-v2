// Impressões da Produção (Paulo, 09/11/2026: um botão "Impressões" perto de Fornecedores e ligado a eles).
// Cada impressão anda por etapas (arte → orçamento → aprovado → arquivo enviado → em impressão → pronto → entregue)
// com a gráfica (fornecedor), a arte na esteira (conteudo_id, abre como vybe:<id>) e o histórico de cada passo.
// Servidor: /api/painel?area=impressoes (server/impressoes.js). Regras ficam lá: sem fornecedor não vai para a gráfica,
// cancelar pede nota, pedido e entrega datam sozinhos, a arte pronta na esteira leva a impressão para orçamento.
// API: window.VybeImpressoes = { abrir(_, { fornecedor }), fechar(), aberto() }
(() => {
  'use strict';
  const URL_API = '/api/painel?area=impressoes';
  const st = { raiz: null, janela: null, antes: null, dados: null, erro: '', carregando: false, sel: '', form: null, cancelar: false, cotar: false, aviso: '', filtro: '', fornecedor: '', todas: false, vista: 'linhas', busca: '', filtros: false, mais: false, deck: 0, deckLista: false, pulou: new Set() };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Cabeçalho único da janela (vbCabecalhoHtml e vbFecharHtml, vybe-core.js). Sem o vybe-core (testes), só o título e as ações.
  const cabecalho = (o) => (typeof window !== 'undefined' && typeof window.vbCabecalhoHtml === 'function' ? window.vbCabecalhoHtml(o) : `<h2${o.id ? ` id="${o.id}"` : ''}>${esc(o.titulo)}</h2>${o.texto ? `<p>${esc(o.texto)}</p>` : ''}${o.acoes || ''}`);
  const botaoX = (attr, classe = '') => (typeof window !== 'undefined' && typeof window.vbFecharHtml === 'function' ? window.vbFecharHtml(attr, classe) : `<button type="button" class="vb-janela-x ${classe}" ${attr} aria-label="Fechar"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`);
  const br = (iso) => (iso ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : '');
  const cli = (nome) => (nome ? (typeof window.cliCor === 'function' ? window.cliCor(nome) : esc(nome)) : '');
  const statusDemanda = (s) => (s ? (typeof window.statusCor === 'function' ? window.statusCor({ status: s }) : esc(s)) : '');
  const reais = (v) => (v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  const estado = (tipo, titulo, texto, acao = '') => (typeof window.vbEstadoHtml === 'function' ? window.vbEstadoHtml({ tipo, titulo, texto, acao })
    : `<div class="vi-vazio"><b>${esc(titulo)}</b><p>${esc(texto)}</p>${acao}</div>`);
  const etapaNome = (id) => st.dados?.etapas?.find((e) => e.id === id)?.nome || id;
  const ABERTAS = (i) => !['entregue', 'cancelado'].includes(i.etapa);

  async function pedir(metodo, corpo) {
    // ?todas=1 traz o histórico inteiro (servidor #549); sem ele, as fechadas só dos últimos 90 dias.
    const r = await fetch(URL_API + (metodo === 'GET' && st.todas ? '&todas=1' : ''), { method: metodo, credentials: 'same-origin', cache: 'no-store',
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
      st.form = null; st.cancelar = false; st.cotar = false;
      if (r.id && corpo.acao === 'impressao_salvar') st.sel = String(r.id);
      await carregar();
    } catch (e) { st.aviso = e.message; pintarAviso(true); }
  }

  // ---------- desenho ----------
  const visiveis = () => (st.dados?.impressoes || []).filter((i) => (!st.fornecedor || String(i.fornecedor_id) === st.fornecedor)
    && (st.filtro === 'atrasadas' ? i.atrasada : st.filtro === 'semfornecedor' ? !i.fornecedor_id && ABERTAS(i) : st.filtro.startsWith('etapa:') ? i.etapa === st.filtro.slice(6) : true));
  // Dias de atraso pela previsão (datas sem hora, sem fuso: só ano/mês/dia).
  const diasDeAtraso = (i) => { const h = String(st.dados?.hoje || new Date().toISOString()).slice(0, 10); if (!i.previsao) return 0;
    return Math.max(0, Math.round((Date.parse(h + 'T12:00:00Z') - Date.parse(String(i.previsao).slice(0, 10) + 'T12:00:00Z')) / 864e5)); };
  const atrasoTxt = (i) => { const n = diasDeAtraso(i); return n ? `atrasada ${n} dia${n === 1 ? '' : 's'}` : 'atrasada'; };
  // Quadro 17: o atraso em vermelho na própria peça e "sem fornecedor · escolher" (abre a edição já no campo da gráfica).
  function cartao(i) {
    return `<button type="button" class="vi-cartao${i.atrasada ? ' atrasada' : ''}${String(i.id) === st.sel ? ' sel' : ''}" data-vi-abrir="${esc(i.id)}">
      <b>${esc(i.titulo)}</b>
      <span class="vi-linha">${cli(i.cliente_nome) || '<em class="vi-mudo">sem cliente</em>'}</span>
      <span class="vi-linha">${i.fornecedor_nome ? esc(i.fornecedor_nome) : `<em class="vi-mudo">sem fornecedor</em>${ABERTAS(i) ? ` · <span class="vi-escolher" data-vi-escolher-forn="${esc(i.id)}">escolher</span>` : ''}`}</span>
      <span class="vi-pe">${[i.material, i.quantidade ? `${Number(i.quantidade).toLocaleString('pt-BR')} un.` : ''].filter(Boolean).map(esc).join(' · ')}
        ${i.previsao ? `<time class="${i.atrasada ? 'atrasada' : ''}">${i.atrasada ? atrasoTxt(i) + ' · ' : 'entrega '}${br(i.previsao)}</time>` : ''}</span>
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
  // A mesma seleção em lista (alternador Etapas | Lista do quadro 17): uma linha por peça.
  function listaHtml() {
    const lista = visiveis();
    if (!lista.length) return '<p class="vi-mudo">Nenhuma impressão neste filtro.</p>';
    return `<div class="vi-tabela-wrap"><table class="vi-tabela"><thead><tr><th>Peça</th><th>Cliente</th><th>Etapa</th><th>Fornecedor</th><th>Entrega</th></tr></thead><tbody>${lista.map((i) => `<tr class="${String(i.id) === st.sel ? 'sel' : ''}">
      <td><button type="button" class="vi-link" data-vi-abrir="${esc(i.id)}">${esc(i.titulo)}</button></td><td>${cli(i.cliente_nome) || '<em class="vi-mudo">interno</em>'}</td><td>${esc(etapaNome(i.etapa))}</td>
      <td>${i.fornecedor_nome ? esc(i.fornecedor_nome) : '<em class="vi-mudo">sem fornecedor</em>'}</td><td>${i.previsao ? `<span class="${i.atrasada ? 't-ruim' : ''}">${br(i.previsao)}${i.atrasada ? ' · ' + atrasoTxt(i) : ''}</span>` : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function ficha() {
    const i = (st.dados.impressoes || []).find((x) => String(x.id) === st.sel); if (!i) return '';
    const etapas = st.dados.etapas || [], k = etapas.findIndex((e) => e.id === i.etapa), prox = ABERTAS(i) ? etapas[k + 1] : null;
    const precisaForn = (id) => ['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(id) && !i.fornecedor_id;
    return `<aside class="vi-ficha" aria-label="Impressão ${esc(i.titulo)}">
      <div class="vi-ficha-topo"><span><small>${esc(etapaNome(i.etapa))}${i.atrasada ? ' · <b class="t-ruim">atrasada</b>' : ''}</small><h3>${esc(i.titulo)}</h3></span>
        <button type="button" class="vi-x" data-vi="fechar-ficha" aria-label="Fechar a ficha"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></button></div>
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
      ${sugestoes(i)}${cotacoes(i)}
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
        <label><span>Fornecedor (gráfica)</span>${(d.fornecedores || []).length ? `<select name="fornecedor_id">${op(d.fornecedores, f.fornecedor_id, 'Ainda sem fornecedor', (x) => [x.nome, x.categoria, x.cidade ? `${x.cidade}${x.uf ? '/' + x.uf : ''}` : ''].filter(Boolean).join(' · '))}</select>`
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
  // Sugestão de gráfica (servidor #549): para impressão em arte, orçamento ou aprovado sem fornecedor, as 3 primeiras do
  // ranking, com o motivo em texto pronto. "Usar" abre a edição com a gráfica escolhida (nada grava sem Salvar).
  function sugestoes(i) {
    const l = Array.isArray(i.sugestao) ? i.sugestao : [];
    if (i.fornecedor_id || !l.length || !ABERTAS(i)) return '';
    return `<h4>Gráficas sugeridas</h4><ul class="vi-sugestoes">${l.map((s) => `<li><span><b>${esc(s.nome)}</b>${s.motivo ? `<small>${esc(s.motivo)}</small>` : ''}</span>
      <button type="button" class="vi-botao" data-vi-usar="${esc(s.fornecedor_id)}">Usar</button></li>`).join('')}</ul>`;
  }
  // Cotações (só a gestão, servidor #549): várias gráficas para a mesma impressão; escolher grava fornecedor, valor e previsão.
  function cotacoes(i) {
    if (!st.dados?.gestao || !Array.isArray(i.cotacoes) || !ABERTAS(i)) return '';
    const forn = st.dados.fornecedores || [];
    const lista = i.cotacoes.map((c) => `<li class="${c.escolhida ? 'escolhida' : ''}"><span><b>${esc(c.fornecedor_nome || 'Fornecedor')}</b>
      <small>${[reais(c.valor), c.prazo_dias != null ? `${c.prazo_dias} dia${Number(c.prazo_dias) === 1 ? '' : 's'}` : '', c.observacao || ''].filter(Boolean).map(esc).join(' · ')}</small></span>
      ${c.escolhida ? '<em class="vi-tag ok">escolhida</em>' : `<button type="button" class="vi-botao" data-vi-escolher="${esc(c.id)}">Escolher</button>`}</li>`).join('');
    const form = st.cotar ? `<form class="vi-cotar" data-vi-form="cotacao"><div class="vi-grade">
        <label><span>Fornecedor</span><select name="fornecedor_id" required><option value="">Escolha…</option>${forn.map((f) => `<option value="${esc(f.id)}">${esc(f.nome)}</option>`).join('')}</select></label>
        <label><span>Valor (R$)</span><input name="valor" type="number" min="0" step="0.01" required></label>
        <label><span>Prazo (dias)</span><input name="prazo_dias" type="number" min="0" step="1"></label>
        <label class="largo"><span>Observação</span><input name="observacao" maxlength="300"></label></div>
        <div class="vi-acoes"><button type="submit" class="vi-botao principal">Guardar cotação</button><button type="button" class="vi-botao" data-vi="nao-cotar">Voltar</button></div></form>` : '';
    return `<h4>Cotações</h4>${lista ? `<ul class="vi-cotacoes">${lista}</ul>` : '<p class="vi-mudo">Nenhuma cotação ainda.</p>'}
      ${form || (forn.length ? '<button type="button" class="vi-link" data-vi="cotar">+ Nova cotação</button>' : '')}`;
  }
  // Ranking das gráficas (servidor #549), com o motivo pronto; sem ranking, o resumo por fornecedor.
  function ranking() {
    const l = st.dados.ranking || []; if (!l.length) return '';
    return `<section class="vi-bloco"><h4>Ranking das gráficas</h4><ol class="vi-ranking">${l.map((f) => `<li><button type="button" data-vi-fornecedor="${esc(f.fornecedor_id)}" aria-pressed="${String(f.fornecedor_id) === st.fornecedor}">
      <b>${esc(f.nome)}</b><small>${esc([f.local || [f.cidade, f.uf].filter(Boolean).join('/'), f.telefone, `${f.entregues} entregue${f.entregues === 1 ? '' : 's'}`, f.pontualidade != null ? `${f.pontualidade}% no prazo` : '', f.prazo_medio_dias != null ? `${String(f.prazo_medio_dias).replace('.', ',')} d em média` : ''].filter(Boolean).join(' · '))}</small>
      ${f.motivo ? `<small class="vi-motivo">${esc(f.motivo)}</small>` : ''}</button></li>`).join('')}</ol></section>`;
  }
  function porFornecedor() {
    if ((st.dados.ranking || []).length) return ranking();
    const l = st.dados.porFornecedor || []; if (!l.length) return '';
    return `<section class="vi-bloco"><h4>Por fornecedor</h4><ul class="vi-forn">${l.map((f) => `<li><button type="button" data-vi-fornecedor="${esc(f.fornecedor_id)}" aria-pressed="${String(f.fornecedor_id) === st.fornecedor}"><b>${esc(f.nome)}</b>
      <small>${f.abertas} aberta${f.abertas === 1 ? '' : 's'}${f.atrasadas ? ` · <span class="t-ruim">${f.atrasadas} atrasada${f.atrasadas === 1 ? '' : 's'}</span>` : ''} · ${f.entregues} entregue${f.entregues === 1 ? '' : 's'}${f.prazo_medio_dias != null ? ` · ${String(f.prazo_medio_dias).replace('.', ',')} d em média` : ''}</small></button></li>`).join('')}</ul></section>`;
  }
  // ---------- Padrão v2 (quadro "Impressões" do moodboard, 12/11/2026) ----------
  // A frase do Nestor, três números, o baralho do que espera um ok à esquerda e, à direita, um cartão com busca,
  // fichas e uma linha por peça (as bolinhas das etapas, a gráfica e o prazo). A linha abre no lugar com a ficha de sempre.
  const CERTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const MAX_LINHAS = 6;
  const cliPonto = (nome) => cli(nome).replace(/>([^<>]*)<\/span>$/, '><span class="p2-nome">$1</span></span>');
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const diaSem = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getUTCDay()]}, ${br(iso)}` : ''; };
  const unidades = (i) => (i.quantidade ? `${Number(i.quantidade).toLocaleString('pt-BR')} ${Number(i.quantidade) === 1 ? 'unidade' : 'unidades'}` : '');
  const etapasDoCaminho = () => (st.dados?.etapas || []).filter((e) => e.id !== 'cancelado');
  // O que espera um ok de quem abre a tela: a cotação mais barata de quem ainda não escolheu (só a gestão) e a gráfica
  // sugerida para a peça sem fornecedor. "Agora não" tira do baralho até fechar a janela.
  function decisoes() {
    const d = st.dados, out = []; if (!d) return out;
    for (const i of d.impressoes || []) {
      if (!ABERTAS(i)) continue;
      const cots = d.gestao && Array.isArray(i.cotacoes) ? i.cotacoes : [];
      if (cots.length && !cots.some((c) => c.escolhida)) { const c = cots.slice().sort((a, b) => Number(a.valor) - Number(b.valor))[0]; out.push({ chave: 'cot:' + c.id, tipo: 'cotacao', i, c, outras: cots.length - 1 }); }
      else if (!i.fornecedor_id && Array.isArray(i.sugestao) && i.sugestao.length) out.push({ chave: 'sug:' + i.id, tipo: 'sugestao', i, s: i.sugestao[0] });
    }
    return out.filter((x) => !st.pulou.has(x.chave)).sort((a, b) => (b.i.atrasada ? 1 : 0) - (a.i.atrasada ? 1 : 0) || String(a.i.previsao || '9').localeCompare(String(b.i.previsao || '9')));
  }
  const prazoHtml = (i, classe = 'p2-sub') => (i.atrasada ? `<span class="p2-pill r">${diasDeAtraso(i) ? `${diasDeAtraso(i)} ${diasDeAtraso(i) === 1 ? 'dia' : 'dias'} de atraso` : 'atrasada'}</span>` : i.previsao ? `<span class="${classe}">entrega ${esc(diaSem(i.previsao))}</span>` : '');
  function cartaHtml(x, k) {
    const i = x.i, pos = k - st.deck, topo = `<p class="vi2-topo"><span class="p2-pill v">${x.tipo === 'cotacao' ? 'Cotação' : 'Gráfica sugerida'}</span>${cliPonto(i.cliente_nome) || '<span class="p2-sub">interno</span>'}<span class="vi2-direita">${prazoHtml(i)}</span></p>`;
    const corpo = x.tipo === 'cotacao'
      ? `<p class="vi2-oq">Fechar ${esc(i.titulo)} com a ${esc(x.c.fornecedor_nome || 'gráfica')} por ${esc(reais(x.c.valor))}</p>
        <div class="vi2-prv"><small>${esc(x.c.fornecedor_nome || 'Fornecedor')}${x.c.prazo_dias != null ? `, prazo de ${esc(x.c.prazo_dias)} ${Number(x.c.prazo_dias) === 1 ? 'dia' : 'dias'}` : ''}</small>${x.c.observacao ? `“${esc(x.c.observacao)}”` : x.outras ? `A mais barata de ${x.outras + 1} cotações.` : 'Única cotação guardada.'}</div>
        <p class="vi2-ef"><b>Se aprovar:</b> a ${esc(x.c.fornecedor_nome || 'gráfica')} vira o fornecedor, e o valor e a previsão vão para a impressão.</p>`
      : `<p class="vi2-oq">Usar a ${esc(x.s.nome)} em ${esc(i.titulo)}</p>
        <div class="vi2-prv"><small>Ranking das gráficas</small>${esc(x.s.motivo || 'A primeira do ranking para esta peça.')}</div>
        <p class="vi2-ef"><b>Se aprovar:</b> a edição abre com a ${esc(x.s.nome)} escolhida; só grava quando você salvar.</p>`;
    return `<div class="v2-carta vi2-carta"${pos < 0 ? ' data-pos="fora"' : pos <= 2 ? ` data-pos="${pos}"` : ''} data-vi-carta="${k}">${topo}${corpo}</div>`;
  }
  // Direção 3 (quadro D3-Impressoes): a coluna "Nestor pede" fica sempre no lugar, num cartão branco à esquerda da
  // tabela. Sem decisão esperando, o cartão diz isso em uma linha (nada de número inventado).
  function baralhoHtml(lista) {
    const n = lista.length; st.deck = Math.min(Math.max(0, st.deck), Math.max(0, n - 1));
    const donos = st.dados?.gestao ? '<span class="d3-selo-donos">só donos</span>' : '';
    const cabeca = `<div class="d3im-pede-topo"><span><b class="p2-h">Nestor pede</b>${donos}</span><span class="p2-sub" data-vi-conta>${n ? `${st.deck + 1} de ${n}` : ''}</span></div>`;
    if (!n) return `<section class="p2-card vi2-pede d3im-pede" aria-label="Nestor pede">${cabeca}<p class="d3im-pede-vazio">Nada pede seu ok agora.</p></section>`;
    if (st.deckLista) return `<section class="p2-card vi2-pede d3im-pede" aria-label="Nestor pede">${cabeca}<div class="vi2-deck-lista">${lista.map((x, k) => `<div class="p2-lin"><p><b>${esc(x.i.titulo)}</b><br><span class="p2-sub">${x.tipo === 'cotacao' ? `${esc(x.c.fornecedor_nome || 'Fornecedor')} · ${esc(reais(x.c.valor))}` : `sugerida: ${esc(x.s.nome)}`}</span></p><button type="button" class="p2-btn s k" data-vi-decidir="${k}">Aprovar</button></div>`).join('')}</div>
        <button type="button" class="p2-link d3im-ver" data-vi="deck-lista">ver um por vez</button></section>`;
    return `<section class="p2-card vi2-pede d3im-pede" aria-label="Nestor pede">${cabeca}<div class="v2-baralho vi2-baralho" aria-live="polite">${lista.map(cartaHtml).join('')}</div>
      <div class="vi2-decide"><button type="button" class="p2-btn d3im-seta" data-vi="anterior" aria-label="Anterior">‹</button><button type="button" class="p2-btn d3im-agora" data-vi="agora-nao">Agora não</button><button type="button" class="p2-btn k v2-estado" data-vi-decidir="atual">Aprovar</button><button type="button" class="p2-btn d3im-seta" data-vi="proxima" aria-label="Próxima">›</button></div>
      <button type="button" class="p2-link d3im-ver" data-vi="deck-lista">ver em lista</button></section>`;
  }
  // As setas só mexem nas posições: o cartão da frente sai e o de trás vem, sem redesenhar a janela.
  function passar(n) {
    const total = decisoes().length; if (!total || st.deckLista) return;
    st.deck = Math.min(Math.max(0, st.deck + n), total - 1);
    if (v2()) { pintar(); return; }
    st.janela?.querySelectorAll('[data-vi-carta]').forEach((c) => { const pos = Number(c.dataset.viCarta) - st.deck; if (pos < 0) c.dataset.pos = 'fora'; else if (pos <= 2) c.dataset.pos = String(pos); else delete c.dataset.pos; });
    const c = st.janela?.querySelector('[data-vi-conta]'); if (c) c.textContent = `${st.deck + 1} de ${total}`;
  }
  function decidir(qual) {
    const lista = decisoes(), x = lista[qual === 'atual' ? st.deck : Number(qual)]; if (!x) return;
    if (x.tipo === 'cotacao') { st.sel = String(x.i.id); gravar({ acao: 'cotacao_escolher', id: x.c.id }, 'Cotação escolhida: fornecedor, valor e previsão foram para a impressão.'); return; }
    st.sel = String(x.i.id); st.form = { ...x.i, fornecedor_id: x.s.fornecedor_id }; pintar(); st.janela.querySelector('[name=fornecedor_id]')?.focus();
  }

  function trilhaHtml(i) {
    const et = etapasDoCaminho(), k = et.findIndex((e) => e.id === i.etapa);
    if (i.etapa === 'cancelado') return '<span class="p2-pill n">Cancelada</span>';
    return `<span class="vi2-tri" role="img" aria-label="Etapa ${k + 1} de ${et.length}: ${esc(etapaNome(i.etapa))}">${et.map((e, n) => `<i class="p2-cx${n < k || i.etapa === 'entregue' ? ' ok' : n === k ? ' at' : ''}">${n < k || i.etapa === 'entregue' ? CERTO : ''}</i>`).join('')}</span>`;
  }
  function linhaHtml(i) {
    const et = st.dados.etapas || [], k = et.findIndex((e) => e.id === i.etapa), prox = ABERTAS(i) ? et[k + 1] : null, aberta = String(i.id) === st.sel;
    const podeAvancar = prox && prox.id !== 'cancelado' && !(['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(prox.id) && !i.fornecedor_id);
    // Direção 3 (quadro D3-Impressoes): uma linha de tabela por peça, com a trilha curta embaixo do nome, a etapa, o
    // fornecedor, o prazo e o botão do próximo passo (o mesmo avanço de etapa de sempre; sem gráfica, escolher a gráfica).
    const forn = i.fornecedor_nome ? esc(i.fornecedor_nome) : '<b class="atencao">sem fornecedor</b>';
    const prazo = i.atrasada ? `<span class="p2-pill r">${diasDeAtraso(i) ? `${diasDeAtraso(i)} ${diasDeAtraso(i) === 1 ? 'dia' : 'dias'}` : 'atrasada'}</span>` : i.previsao ? `<span class="vi2-prazo">${esc(diaSem(i.previsao))}</span>` : '<span class="p2-sub">sem data</span>';
    const passo = !i.fornecedor_id && ABERTAS(i) ? `<button type="button" class="p2-btn s vi-escolher" data-vi-escolher-forn="${esc(i.id)}">Escolher gráfica</button>`
      : podeAvancar ? `<button type="button" class="p2-btn s v2-estado${i.atrasada ? ' k' : ''}" data-vi-etapa="${esc(prox.id)}" data-vi-id="${esc(i.id)}">${prox.id === 'entregue' ? 'Marcar entregue' : esc(prox.nome)}</button>` : '';
    return `<div class="v2-abre p2-abre vi2-item${aberta ? ' sel' : ''}" aria-expanded="${aberta}"><div class="p2-lin vi2-tab"><div class="vi2-meio" data-vi-linha="${esc(i.id)}">
        <p class="vi2-l1"><span>${cliPonto(i.cliente_nome) || '<span class="p2-sub">interno</span>'} · <button type="button" class="vi2-nome" data-vi-abrir="${esc(i.id)}" aria-expanded="${aberta}">${esc(i.titulo)}</button>${i.quantidade ? ` · ${esc(Number(i.quantidade).toLocaleString('pt-BR'))} un` : ''}</span></p>
        ${trilhaHtml(i)}</div><span class="vi2-onde">${esc(etapaNome(i.etapa))}</span><span class="vi2-forn">${forn}</span>${prazo}<span class="vi2-passo">${passo}</span>
      </div><div class="v2-mais"><div>${aberta ? ficha() : ''}</div></div></div>`;
  }
  function linhasHtml() {
    const q = norm(st.busca).trim(), todas = visiveis().filter((i) => !q || norm(`${i.titulo} ${i.cliente_nome || ''} ${i.fornecedor_nome || ''} ${i.material || ''}`).includes(q));
    const tudo = st.mais || st.todas || Boolean(q) || Boolean(st.filtro);
    const abertas = todas.filter(ABERTAS).sort((a, b) => (b.atrasada ? 1 : 0) - (a.atrasada ? 1 : 0) || String(a.previsao || '9').localeCompare(String(b.previsao || '9')));
    const fechadas = todas.filter((i) => !ABERTAS(i));
    const lista = tudo ? [...abertas, ...fechadas] : abertas.slice(0, MAX_LINHAS);
    // A peça escolhida aparece mesmo que esteja recolhida.
    const sel = st.sel && !lista.some((i) => String(i.id) === st.sel) ? todas.find((i) => String(i.id) === st.sel) : null; if (sel) lista.push(sel);
    const fora = abertas.length - lista.filter(ABERTAS).length, recolhidas = tudo ? 0 : fechadas.length - (sel && !ABERTAS(sel) ? 1 : 0);
    const pe = [fora > 0 ? `+ ${fora} ${fora === 1 ? 'aberta' : 'abertas'}` : '', recolhidas > 0 ? `${recolhidas} ${recolhidas === 1 ? 'entregue ou cancelada fica recolhida' : 'entregues ou canceladas ficam recolhidas'}` : ''].filter(Boolean).join(' · ');
    if (!lista.length) return `<p class="p2-vazio">${q || st.filtro || st.fornecedor ? 'Nenhuma impressão neste filtro.' : 'Nenhuma impressão aberta agora.'}${fechadas.length && !tudo ? ' <button type="button" class="p2-link" data-vi="mais">mostrar as entregues</button>' : ''}</p>`;
    return `<div class="vi2-cab" aria-hidden="true"><span>Peça</span><span>Etapa</span><span>Fornecedor</span><span>Prazo</span><span></span></div>${lista.map(linhaHtml).join('')}${pe || st.mais ? `<p class="p2-sub p2-pe vi2-pe">${pe}${pe ? ' · ' : ''}<button type="button" class="p2-link" data-vi="mais">${st.mais ? 'recolher' : 'mostrar'}</button></p>` : ''}`;
  }
  const vistaHtml = () => (st.vista === 'etapas' ? quadro() + ficha() : st.vista === 'lista' ? listaHtml() + ficha() : linhasHtml());
  function pintarLinhas() { if (v2()) { pintar(); return; } const c = st.janela?.querySelector('.vi2-linhas'); if (c) c.innerHTML = vistaHtml(); }
  function corpo() {
    if (!st.dados && !st.erro) return estado('carregando', 'Carregando as impressões', '');
    if (st.erro && !st.dados) return estado('erro', 'Não deu para abrir Impressões', st.erro, '<button type="button" class="p2-btn s" data-vi="recarregar">Tentar de novo</button>');
    const d = st.dados, R = d.resumo || {}, todas = d.impressoes || [], abertas = todas.filter(ABERTAS);
    // Vazio (acabamento 15/11): uma frase e uma ação, no bloco laranja do Nestor; o "+ Nova impressão" do topo só
    // aparece quando já há impressão.
    const fraseVazia = '<small class="d3im-quem">Nestor · Compras</small><span>Nenhuma impressão ainda. Acompanhe aqui da arte à entrega na gráfica.</span>';
    if (!todas.length) return `${st.form ? `<div class="p2-card">${formulario()}</div>` : typeof window.d3AcaoHtml === 'function' ? window.d3AcaoHtml({ agente: 'N', frase: fraseVazia, botao: 'Cadastrar a primeira', attrs: 'data-vi="nova"' }) : `<div class="p2-card vi2-vazio"><p>${fraseVazia}</p><button type="button" class="p2-btn s" data-vi="nova">Cadastrar a primeira</button></div>`}`;
    const chip = (k, rot, n) => `<button type="button" class="p2-chip vi-chip" data-vi-filtro="${k}" aria-pressed="${st.filtro === k}">${rot}${n != null ? ` <b>${n}</b>` : ''}</button>`;
    const fNome = st.fornecedor ? (d.fornecedores || []).find((f) => String(f.id) === st.fornecedor)?.nome || 'fornecedor' : '';
    const vista = (k, r) => `<button type="button" data-vi-vista="${k}" aria-pressed="${st.vista === k}">${r}</button>`;
    // A frase e os números saem das mesmas impressões da lista.
    const atrasadas = abertas.filter((i) => i.atrasada), semForn = abertas.filter((i) => !i.fornecedor_id);
    const urgente = atrasadas[0] || abertas.filter((i) => i.previsao).sort((a, b) => String(a.previsao).localeCompare(String(b.previsao)))[0] || null;
    const nA = R.abertas ?? abertas.length, nAt = R.atrasadas ?? atrasadas.length, nS = R.semFornecedor ?? semForn.length;
    // Direção 3: a frase do Nestor vira o bloco de ação laranja, com uma coisa só (a mais urgente) e o botão que a abre.
    const quando = (i) => (i.atrasada ? `atrasada ${diasDeAtraso(i) ? `há ${diasDeAtraso(i)} ${diasDeAtraso(i) === 1 ? 'dia' : 'dias'}` : ''}`.trim() : `entrega ${diaSem(i.previsao)}`);
    const nome = (i) => `${i.titulo}${i.cliente_nome ? ` de ${i.cliente_nome}` : ''}`;
    const fraseAcao = urgente ? `${esc(nome(urgente))}: ${esc(quando(urgente))}${urgente.fornecedor_id ? '' : ' e sem gráfica'}.` : nS ? `${nS} sem fornecedor.` : `${nA} ${nA === 1 ? 'impressão aberta' : 'impressões abertas'}, nenhuma atrasada.`;
    // Sem urgente não há botão: a frase vai na nota branca (o laranja é só para ação).
    const fala = typeof window.d3AcaoHtml === 'function' ? (urgente ? window.d3AcaoHtml : window.d3NotaHtml || window.d3AcaoHtml)({ agente: 'N', frase: `<small class="d3im-quem">Nestor · Compras</small><span>${fraseAcao}</span>`,
      botao: urgente ? `Ver ${String(urgente.titulo).length > 18 ? 'a peça' : urgente.titulo}` : '', attrs: urgente ? `data-vi-abrir="${esc(urgente.id)}"` : '' }) : '';
    const porEtapa = etapasDoCaminho().map((e) => { const n = abertas.filter((i) => i.etapa === e.id).length; return n ? `${n} ${String(e.nome).toLowerCase()}` : ''; }).filter(Boolean).slice(0, 3).join(' · ');
    const nomes = (l) => l.slice(0, 2).map((i) => String(i.titulo).toLowerCase()).join(' · ') + (l.length > 2 ? ` +${l.length - 2}` : '');
    const num = (o, pe = '') => (typeof window.d3NumHtml === 'function' ? window.d3NumHtml(o).replace(/<\/(div|button)>$/, `${pe ? `<span class="d3im-pe">${pe}</span>` : ''}</$1>`) : '');
    // Entregues no mês e a linha das entregas das últimas seis semanas (entregue_em das impressões dos últimos 90 dias).
    const hojeIso = String(d.hoje || new Date().toISOString()).slice(0, 10), mesIso = hojeIso.slice(0, 7);
    const entregues = todas.filter((i) => i.etapa === 'entregue' && i.entregue_em);
    const doMes = entregues.filter((i) => String(i.entregue_em).slice(0, 7) === mesIso), noPrazo = doMes.filter((i) => i.previsao && String(i.entregue_em) <= String(i.previsao)).length;
    const semanas = Array.from({ length: 6 }, (_, k) => { const fim = Date.parse(hojeIso + 'T12:00:00Z') - (5 - k) * 7 * 864e5; return entregues.filter((i) => { const t = Date.parse(String(i.entregue_em).slice(0, 10) + 'T12:00:00Z'); return t <= fim && t > fim - 7 * 864e5; }).length; });
    const atr0 = atrasadas[0];
    const kpis = `<div class="d3im-nums">
      ${num({ rotulo: 'Abertas', valor: String(nA), attrs: 'data-vi-filtro=""' }, esc(porEtapa || 'nada andando'))}
      ${num({ rotulo: 'Atrasadas', valor: String(nAt), tom: nAt ? 'r' : '', attrs: 'data-vi-filtro="atrasadas"' }, atr0 ? `${esc(atr0.cliente_nome || atr0.titulo)}${diasDeAtraso(atr0) ? ` · ${diasDeAtraso(atr0)} ${diasDeAtraso(atr0) === 1 ? 'dia' : 'dias'}` : ''}` : 'nenhuma')}
      ${num({ rotulo: 'Sem fornecedor', valor: String(nS), tom: nS ? 'a' : '', attrs: 'data-vi-filtro="semfornecedor"' }, semForn.length ? esc(nomes(semForn)) : 'todas com gráfica')}
      ${num({ rotulo: 'Entregues no mês', valor: String(doMes.length), serie: entregues.length ? semanas : null }, doMes.length ? `no prazo · ${noPrazo}` : 'nenhuma ainda')}</div>`;
    const dec = decisoes();
    const filtrosMais = st.filtros ? `<div class="vi2-filtros-mais"><div class="p2-filtros"><span class="p2-sub">Ver como</span><span class="p2-seg vi-vista" role="group" aria-label="Ver como">${vista('linhas', 'Linhas')}${vista('etapas', 'Etapas')}${vista('lista', 'Tabela')}</span></div>${porFornecedor()}</div>` : '';
    return `${fala}${kpis}${st.form ? `<div class="p2-card">${formulario()}</div>` : ''}
      <div class="vi2-duas d3im-duas">${baralhoHtml(dec)}
        <div class="p2-card vi2-lista">
          <div class="p2-filtros vi-filtros d3im-filtros" role="group" aria-label="Filtrar"><label class="p2-oculto" for="vi-busca">Buscar peça, cliente ou gráfica</label><input id="vi-busca" class="p2-busca" type="search" placeholder="Buscar peça, cliente ou gráfica" data-vi-busca value="${esc(st.busca)}">
            ${chip('', 'Abertas', nA)}${chip('atrasadas', 'Atrasadas', nAt)}${chip('semfornecedor', 'Sem fornecedor', nS)}
            ${fNome ? `<button type="button" class="p2-chip" data-vi-fornecedor="" aria-pressed="true">${esc(fNome)} ✕</button>` : ''}
            <button type="button" class="p2-chip" data-vi="todas" aria-pressed="${st.todas}" title="Histórico inteiro: sem marcar, as entregues e canceladas aparecem só dos últimos 90 dias">Histórico</button>
            <button type="button" class="p2-chip d3im-mais" data-vi="filtros" aria-expanded="${st.filtros}" aria-label="Mais: ver como e gráficas" title="Ver como e gráficas">⋯</button></div>
          ${filtrosMais}
          <div class="vi2-linhas">${vistaHtml()}</div>
        </div></div>`;
  }
  // ─── Direção V2 · Impressões nas pranchas V2-M-Impressoes, -Etapas e -Lista (16/11/2026) ─────
  // A janela vira vidro fumê e as três vistas ganham esqueleto próprio. Linhas: o funil das 7 etapas no vidro, uma folha
  // com uma linha por peça (a que pede você, as que estão na gráfica e as de antes dela) e a consulta à direita (o cartão
  // laranja do Nestor, as gráficas, o mês e os atalhos). Etapas: sete colunas no vidro, um cartão por peça; arrastar o
  // cartão muda a etapa (o mesmo impressao_etapa do botão). Lista: a tabela inteira numa folha, com as somas no pé.
  // A peça escolhida abre a ficha de sempre (ficha()), no lugar ou ao lado; formulário, cotações, sugestões e o que o
  // Nestor pede (decisoes) são os mesmos. Só no computador; no celular fica a tela de antes (corpo), até a prancha de lá.
  const v2 = () => typeof window.matchMedia === 'function' && !window.matchMedia('(max-width: 700px)').matches;
  const IC2 = { mais: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>', lupa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/></svg>',
    seta: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', antes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    pontos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-width="3" d="M6 12h.01M12 12h.01M18 12h.01"/></svg>', x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>' };
  const COR_ETAPA = { arte: 'var(--d3-meta)', orcamento: 'var(--d3-perigo)', aprovado: 'var(--d3-acao)', arquivo_enviado: 'var(--d3-info)', em_impressao: 'var(--d3-info)', pronto: 'var(--d3-pronto)', entregue: 'var(--d3-pronto)', cancelado: 'var(--d3-meta)' };
  const NA_GRAFICA = ['arquivo_enviado', 'em_impressao', 'pronto'];
  const foto2 = (nome) => (nome && typeof pv2Foto === 'function' ? pv2Foto(nome) : `<i class="d3v-foto" aria-hidden="true">${esc(String(nome || 'VY').trim().slice(0, 2).toUpperCase())}</i>`);
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const diaCurto = (iso) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z'); return Number.isFinite(d.getTime()) ? `${['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][d.getUTCDay()]} ${br(iso)}` : ''; };
  const qtd2 = (i) => (i.quantidade ? `${Number(i.quantidade).toLocaleString('pt-BR')} un` : '');
  const busca2 = (lista) => { const q = norm(st.busca).trim(); return q ? lista.filter((i) => norm(`${i.titulo} ${i.cliente_nome || ''} ${i.fornecedor_nome || ''} ${i.material || ''}`).includes(q)) : lista; };
  const ordem2 = (a, b) => (b.atrasada ? 1 : 0) - (a.atrasada ? 1 : 0) || String(a.previsao || '9').localeCompare(String(b.previsao || '9'));
  // A entrega em poucas palavras: o atraso em vermelho, "retirar" em verde quando está pronta, a data nos outros casos.
  function entrega2(i) {
    if (i.etapa === 'entregue') return `<span>entregue ${esc(br(i.entregue_em || i.previsao))}</span>`;
    if (i.etapa === 'cancelado') return '<span class="m">cancelada</span>';
    if (i.atrasada) return `<span class="r">${diasDeAtraso(i) ? `${plural(diasDeAtraso(i), 'dia', 'dias')} de atraso` : 'atrasada'}</span>`;
    if (i.etapa === 'pronto') return `<span class="g">retirar${i.previsao ? ` · ${esc(br(i.previsao))}` : ''}</span>`;
    return i.previsao ? `<span>${esc(diaCurto(i.previsao))}</span>` : '<span class="m">sem data</span>';
  }
  const grafica2 = (i) => (i.fornecedor_nome ? `<span>${esc(i.fornecedor_nome)}</span>` : ABERTAS(i) ? `<button type="button" class="imp2-semg" data-vi-escolher-forn="${esc(i.id)}" title="Escolher a gráfica">sem gráfica</button>` : '<span class="m">sem gráfica</span>');
  const etapa2 = (i) => `<span class="d3v-st" style="--st:${COR_ETAPA[i.etapa] || 'var(--d3-meta)'}"><i aria-hidden="true"></i>${esc(etapaNome(i.etapa))}</span>`;
  function trilha2(i) {
    const et = etapasDoCaminho(), k = et.findIndex((e) => e.id === i.etapa);
    return `<span class="imp2-trilha" role="img" aria-label="${i.etapa === 'cancelado' ? 'Cancelada' : `Etapa ${k + 1} de ${et.length}: ${esc(etapaNome(i.etapa))}`}">${et.map((e, n) => `<i${i.etapa === 'entregue' || n < k ? ' class="ok"' : n === k ? ` class="vez" style="--st:${COR_ETAPA[i.etapa]}"` : ''}></i>`).join('')}</span>`;
  }
  // O que a aba da folha mostra (Abertas, Entregues, Canceladas; na Lista, também Todas), com a busca e os filtros.
  function daAba2() {
    const todas = busca2(visiveis()), aba = st.aba || (st.vista === 'lista' ? 'todas' : 'abertas');
    const lista = aba === 'entregues' ? todas.filter((i) => i.etapa === 'entregue') : aba === 'canceladas' ? todas.filter((i) => i.etapa === 'cancelado') : aba === 'todas' ? todas : todas.filter(ABERTAS);
    const fechadas = (a, b) => String(b.entregue_em || b.previsao || '').localeCompare(String(a.entregue_em || a.previsao || ''));
    const ord = st.porGrafica ? (a, b) => String(a.fornecedor_nome || '￿').localeCompare(String(b.fornecedor_nome || '￿'), 'pt-BR') || ordem2(a, b)
      : (a, b) => (ABERTAS(a) ? 0 : 1) - (ABERTAS(b) ? 0 : 1) || (ABERTAS(a) ? ordem2(a, b) : fechadas(a, b));
    return { todas, aba, lista: [...lista].sort(ord) };
  }
  const abas2 = (todas, aba, comTodas) => { const n = { todas: todas.length, abertas: todas.filter(ABERTAS).length, entregues: todas.filter((i) => i.etapa === 'entregue').length, canceladas: todas.filter((i) => i.etapa === 'cancelado').length };
    const f = (k, t) => `<button type="button" role="radio" data-vi-aba="${k}" aria-checked="${aba === k}">${t} <b>${n[k]}</b></button>`;
    return `<span class="d3m-c-abas" role="radiogroup" aria-label="Mostrar">${comTodas ? f('todas', 'Todas') : ''}${f('abertas', 'Abertas')}${f('entregues', 'Entregues')}${f('canceladas', 'Canceladas')}</span>
      <span class="d3m-c-abas imp2-abas2"><button type="button" role="switch" data-vi="por-grafica" aria-checked="${Boolean(st.porGrafica)}" title="Juntar as peças de cada gráfica">Por gráfica</button>${comTodas ? `<button type="button" role="switch" data-vi="todas" aria-checked="${st.todas}" title="Sem marcar, as entregues e canceladas aparecem só dos últimos 90 dias">Histórico inteiro</button>` : ''}</span>`; };
  const vazio2 = (todas) => `<p class="d3v-estado"><b>${st.busca.trim() || st.filtro || st.fornecedor ? 'Nenhuma impressão neste filtro' : todas.length ? 'Nada nesta aba' : 'Nenhuma impressão ainda'}</b>${st.busca.trim() || st.filtro || st.fornecedor ? 'Troque a busca ou o filtro.' : 'Acompanhe aqui da arte à entrega na gráfica.'}${todas.length ? '' : '<button type="button" class="d3v-btn" data-vi="nova">Cadastrar a primeira</button>'}</p>`;

  // ---------- Linhas ----------
  function linha2(i, grupo) {
    const aberta = String(i.id) === st.sel;
    return `<div class="imp2-lin${aberta ? ' aberta' : ''}" data-vi-linha="${esc(i.id)}" aria-expanded="${aberta}" title="Abrir a ficha no lugar">${grupo}${foto2(i.cliente_nome)}
      <span class="imp2-oq">${i.cliente_nome ? `<b>${esc(i.cliente_nome)}</b>` : ''}<button type="button" class="imp2-nome" data-vi-abrir="${esc(i.id)}" aria-expanded="${aberta}">${esc(i.titulo)}${qtd2(i) ? `, ${esc(qtd2(i))}` : ''}</button></span>
      ${trilha2(i)}${etapa2(i)}<span class="imp2-c">${grafica2(i)}</span><span class="imp2-c">${entrega2(i)}</span><span class="imp2-v${i.valor == null ? ' m' : ''}">${i.valor == null ? 'sem valor' : esc(reais(i.valor))}</span></div>${aberta ? `<div class="imp2-det">${ficha()}</div>` : ''}`;
  }
  function linhas2Html() {
    const { todas, lista } = daAba2();
    if (!lista.length) return vazio2(todas);
    const grupoDe = (i) => (st.porGrafica ? [i.fornecedor_nome || 'Sem gráfica', i.fornecedor_nome ? '' : 'a'] : !ABERTAS(i) ? [i.etapa === 'entregue' ? 'Entregue' : 'Cancelada', ''] : i.atrasada ? ['Agora', 'r'] : NA_GRAFICA.includes(i.etapa) ? ['Na gráfica', ''] : ['Antes dela', '']);
    let antes = '';
    return lista.map((i) => { const [nome, tom] = grupoDe(i), novo = nome !== antes; antes = nome; return linha2(i, `<span class="imp2-g ${tom}" title="${esc(nome)}">${novo ? esc(nome) : ''}</span>`); }).join('');
  }
  function funil2(abertas, doMes) {
    return `<div class="imp2-funil" role="group" aria-label="As 7 etapas">${etapasDoCaminho().map((e, k) => { const l = abertas.filter((i) => i.etapa === e.id), on = st.filtro === 'etapa:' + e.id, velha = l.filter((i) => i.atrasada).length;
      const n = e.id === 'entregue' ? doMes.length : l.length, nota = e.id === 'entregue' ? 'no mês' : velha ? plural(velha, 'atrasada', 'atrasadas') : '';
      return `<button type="button" class="imp2-fase" role="switch" aria-checked="${on}" data-vi-filtro="${on ? '' : 'etapa:' + e.id}" title="${on ? 'Mostrar todas as etapas' : `Mostrar só: ${esc(e.nome)}`}"><span><b>${k + 1}</b>${esc(e.nome)}</span><span class="imp2-fase-n${velha && e.id !== 'entregue' ? ' r' : ''}"><b>${n}</b>${nota ? `<small class="d3m-c-s">${nota}</small>` : ''}</span></button>`; }).join('')}</div>`;
  }
  // O cartão laranja: primeiro o que o Nestor pede (cotação para fechar, gráfica sugerida), depois a peça mais urgente.
  function laranja2(abertas) {
    const dec = decisoes(), bt = (txt, attrs, sec) => `<button type="button" class="d3m-btn l${sec ? ' s' : ''}" ${attrs}>${txt}</button>`;
    st.deck = Math.min(Math.max(0, st.deck), Math.max(0, dec.length - 1));
    const x = dec[st.deck], urg = abertas.filter((i) => i.atrasada).sort(ordem2)[0] || abertas.filter((i) => i.previsao).sort(ordem2)[0] || null;
    const setas = dec.length > 1 ? `<span class="imp2-setas"><button type="button" class="d3m-btn l s" data-vi="anterior" aria-label="Pedido anterior"${st.deck ? '' : ' disabled'}>${IC2.antes}</button><span data-vi-conta>${st.deck + 1} de ${dec.length}</span><button type="button" class="d3m-btn l s" data-vi="proxima" aria-label="Próximo pedido"${st.deck < dec.length - 1 ? '' : ' disabled'}>${IC2.seta}</button></span>` : '';
    const c = x ? (x.tipo === 'cotacao'
        ? { rot: 'cotação para fechar', num: esc(reais(x.c.valor)), frase: `para fechar ${esc(x.i.titulo)} com a ${esc(x.c.fornecedor_nome || 'gráfica')}`, sub: `${x.outras ? `A mais barata de ${x.outras + 1} cotações. ` : ''}Se aprovar, fornecedor, valor e previsão vão para a impressão.` }
        : { rot: 'gráfica sugerida', num: '', frase: `Usar a ${esc(x.s.nome)} em ${esc(x.i.titulo)}`, sub: `${esc(x.s.motivo || 'A primeira do ranking para esta peça.')} A edição abre com ela escolhida; só grava quando você salvar.` })
      : urg ? (urg.atrasada ? { rot: NA_GRAFICA.includes(urg.etapa) ? 'parada na gráfica' : 'atrasada', num: diasDeAtraso(urg) ? plural(diasDeAtraso(urg), 'dia', 'dias') : '', frase: `${diasDeAtraso(urg) ? 'de atraso em' : 'Atrasada:'} ${esc(urg.titulo)}${urg.cliente_nome ? ` de ${esc(urg.cliente_nome)}` : ''}`, sub: `${urg.fornecedor_nome ? `Na ${esc(urg.fornecedor_nome)}. ` : 'Ainda sem gráfica. '}A entrega era ${esc(diaCurto(urg.previsao))}.` }
        : { rot: 'próxima entrega', num: '', frase: `${esc(urg.titulo)}${urg.cliente_nome ? ` de ${esc(urg.cliente_nome)}` : ''} entrega ${esc(diaCurto(urg.previsao))}`, sub: `${esc(etapaNome(urg.etapa))}${urg.fornecedor_nome ? ` na ${esc(urg.fornecedor_nome)}` : ' · ainda sem gráfica'}.` })
      : { rot: 'impressões em dia', num: '', frase: abertas.length ? `${plural(abertas.length, 'impressão aberta', 'impressões abertas')}, nenhuma atrasada` : 'Nenhuma impressão aberta', sub: 'Nada pede seu ok agora.' };
    const bts = x ? bt('Aprovar', 'data-vi-decidir="atual"') + bt('Agora não', 'data-vi="agora-nao"', true) + bt('Ver a peça', `data-vi-abrir="${esc(x.i.id)}"`, true)
      : urg ? bt('Ver a impressão', `data-vi-abrir="${esc(urg.id)}"`) + (urg.fornecedor_id ? '' : bt('Escolher gráfica', `data-vi-escolher-forn="${esc(urg.id)}"`, true)) : bt('Nova impressão', 'data-vi="nova"');
    return `<section class="d3m-laranja imp2-laranja" aria-label="O que pede você agora" aria-live="polite"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">N</span>Nestor · ${c.rot}${st.dados?.gestao && x ? ' · só donos' : ''}${setas}</span>
      <div class="d3m-lar-txt">${c.num ? `<b class="d3m-lar-num">${c.num}</b>` : ''}<b class="d3-acao-frase">${c.frase}</b><small class="d3m-c-s">${c.sub}</small></div><div class="d3m-lar-bts">${bts}</div></section>`;
  }
  function lado2(abertas, doMes) {
    const d = st.dados, forn = (d.porFornecedor || []).filter((f) => f.abertas || String(f.fornecedor_id) === st.fornecedor).sort((a, b) => b.abertas - a.abertas).slice(0, 5);
    const graficas = `<div class="d3m-cons"><div class="d3m-cons-cab"><b>Gráficas</b><span>abertas · prazo médio</span></div>
      ${forn.map((f) => `<button type="button" class="d3m-vlin" role="switch" aria-checked="${String(f.fornecedor_id) === st.fornecedor}" data-vi-fornecedor="${esc(f.fornecedor_id)}" title="Mostrar só as peças desta gráfica"><span class="d3m-vnome"><b>${esc(f.nome)}</b></span><span class="d3m-vn"><b>${f.abertas}</b>${f.prazo_medio_dias != null ? ` · ${esc(String(f.prazo_medio_dias).replace('.', ','))} ${Number(f.prazo_medio_dias) === 1 ? 'dia' : 'dias'}` : ''}</span>${IC2.seta}</button>`).join('') || '<p class="d3m-vvazio">Nenhuma peça em gráfica agora.</p>'}</div>`;
    const noPrazo = doMes.filter((i) => i.previsao && String(i.entregue_em) <= String(i.previsao)).length, gasto = doMes.reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const mes = new Date(String(d.hoje || new Date().toISOString()).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const tile = (v, r) => `<div class="imp2-tile"><b>${v}</b><span>${r}</span></div>`;
    const noMes = `<div class="d3m-cons"><div class="d3m-cons-cab"><b>${esc(mes.charAt(0).toUpperCase() + mes.slice(1))}</b><span>entregues</span></div><div class="imp2-tiles">${tile(doMes.length, doMes.length === 1 ? 'entregue' : 'entregues')}${tile(`${noPrazo} de ${doMes.length}`, 'no prazo')}${d.gestao ? tile(esc(Number(gasto).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })), 'gasto') : ''}</div></div>`;
    const abrir = `<div class="d3m-cons imp2-abrir"><div class="d3m-cons-cab"><b>Abrir</b></div>
      <button type="button" class="d3m-vlin" data-vi="cadastrar-fornecedor" title="Gráficas, estúdios e parceiros"><span class="d3m-vnome"><b>Fornecedores</b></span>${IC2.seta}</button>
      <button type="button" class="d3m-vlin" role="switch" aria-checked="${st.todas}" data-vi="todas" title="Sem marcar, as entregues e canceladas aparecem só dos últimos 90 dias"><span class="d3m-vnome"><b>Histórico inteiro</b></span>${IC2.seta}</button></div>`;
    return `<aside class="d3m-lado" aria-label="Consulta">${laranja2(abertas)}${graficas}${noMes}${abrir}</aside>`;
  }
  function vistaLinhas2(abertas, doMes) {
    const { todas, aba } = daAba2(), semG = abertas.filter((i) => !i.fornecedor_id).length, atras = abertas.filter((i) => i.atrasada).length, prontas = abertas.filter((i) => i.etapa === 'pronto').length;
    const emAberto = abertas.filter((i) => i.fornecedor_id).reduce((s, i) => s + (Number(i.valor) || 0), 0);
    const olho = `<button type="button" class="${semG ? 'a' : ''}" role="switch" aria-checked="${st.filtro === 'semfornecedor'}" data-vi-filtro="${st.filtro === 'semfornecedor' ? '' : 'semfornecedor'}"><b>${semG}</b> sem gráfica escolhida</button><button type="button" class="${atras ? 'r' : ''}" role="switch" aria-checked="${st.filtro === 'atrasadas'}" data-vi-filtro="${st.filtro === 'atrasadas' ? '' : 'atrasadas'}"><b>${atras}</b> ${atras === 1 ? 'atrasada' : 'atrasadas'}</button><span class="${prontas ? 'g' : ''}"><b>${prontas}</b> ${prontas === 1 ? 'pronta para retirar' : 'prontas para retirar'}</span>${st.dados.gestao ? `<span><b>${esc(reais(emAberto))}</b> em aberto nas gráficas</span>` : ''}`;
    const folha = st.form ? `<section class="d3m-c-folha imp2-folha imp2-rola" aria-label="${st.form.id ? 'Editar impressão' : 'Nova impressão'}">${formulario()}</section>`
      : `<section class="d3m-c-folha imp2-folha" aria-label="Impressões"><div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">${aba === 'abertas' ? plural(abertas.length, 'impressão aberta', 'impressões abertas') : aba === 'entregues' ? 'Entregues' : 'Canceladas'} <span>· ${st.porGrafica ? 'juntas por gráfica' : aba === 'abertas' ? 'a entrega mais próxima primeiro' : 'as mais recentes primeiro'}</span></b>${abas2(todas, aba, false)}</div>
        <div class="imp2-cab" aria-hidden="true"><span></span><span></span><span>Cliente e peça</span><span>Arte até entregue</span><span>Etapa</span><span>Gráfica</span><span>Entrega</span><span>Valor</span></div>
        <div class="imp2-lista">${linhas2Html()}</div><div class="imp2-pe"><span class="imp2-pe-rot">De olho</span>${olho}</div></section>`;
    return `${funil2(abertas, doMes)}<div class="d3m-c-corpo imp2">${folha}${lado2(abertas, doMes)}</div>`;
  }

  // ---------- Etapas ----------
  function cartao2(i) {
    return `<button type="button" class="imp2-cartao${String(i.id) === st.sel ? ' sel' : ''}" data-vi-abrir="${esc(i.id)}"${ABERTAS(i) ? ` draggable="true" data-vi-arrasta="${esc(i.id)}"` : ''}><span class="imp2-cli">${foto2(i.cliente_nome)}<span>${esc(i.cliente_nome || 'Interno')}</span></span>
      <b>${esc(i.titulo)}</b>${qtd2(i) ? `<span class="m">${esc(qtd2(i))}</span>` : ''}<span class="imp2-cart-pe">${i.fornecedor_nome ? `<span>${esc(i.fornecedor_nome)}</span>` : '<span class="a">sem gráfica</span>'}${entrega2(i)}</span></button>`;
  }
  function cartaoLaranja2(i) {
    return `<div class="d3m-laranja imp2-cart-l"${ABERTAS(i) ? ` draggable="true" data-vi-arrasta="${esc(i.id)}"` : ''}><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">N</span>Nestor · ${diasDeAtraso(i) ? `há ${plural(diasDeAtraso(i), 'dia', 'dias')}` : 'atrasada'}</span>
      <b class="imp2-cart-t">${esc(i.titulo)}${i.cliente_nome ? ` de ${esc(i.cliente_nome)}` : ''}</b><small class="d3m-c-s">${esc(etapaNome(i.etapa))} parada${i.fornecedor_nome ? ` na ${esc(i.fornecedor_nome)}` : ', sem gráfica'}. Entrega ${esc(diaCurto(i.previsao))}.</small>
      <button type="button" class="d3m-btn l" data-vi-abrir="${esc(i.id)}">Ver a impressão</button></div>`;
  }
  function vistaEtapas2(abertas, doMes) {
    const lista = busca2(visiveis()), pior = abertas.filter((i) => i.atrasada).sort(ordem2)[0], MAXE = 2;
    const colunas = etapasDoCaminho().map((e, k) => { const l = lista.filter((i) => i.etapa === e.id).sort(e.id === 'entregue' ? (a, b) => String(b.entregue_em || '').localeCompare(String(a.entregue_em || '')) : ordem2);
      const vis = e.id === 'entregue' && !st.mais ? l.slice(0, MAXE) : l, fora = l.length - vis.length;
      return `<section class="imp2-col" data-vi-solta="${esc(e.id)}" aria-label="${esc(e.nome)}"><div class="imp2-col-cab"><span><b>${k + 1}</b> ${esc(e.nome)}</span><span>${e.id === 'entregue' ? `${doMes.length} no mês` : l.length}</span></div>
        <div class="imp2-col-lista">${vis.map((i) => (pior && i.id === pior.id ? cartaoLaranja2(i) : cartao2(i))).join('') || `<p class="imp2-col-vazio">Nada ${e.id === 'arquivo_enviado' ? 'esperando o arquivo' : 'aqui'}.</p>`}
          ${fora > 0 || (e.id === 'entregue' && st.mais && l.length > MAXE) ? `<button type="button" class="imp2-col-mais" data-vi="mais">${st.mais ? 'recolher' : `mais ${fora} ${fora === 1 ? 'entregue' : 'entregues'}`}</button>` : ''}</div>
        ${e.id === 'arte' ? `<button type="button" class="imp2-col-nova" data-vi="nova">${IC2.mais}impressão</button>` : ''}</section>`; }).join('');
    const canceladas = lista.filter((i) => i.etapa === 'cancelado').length;
    return `<div class="d3m-c-corpo imp2 imp2-e${st.sel || st.form ? '' : ' um'}"><div class="imp2-quadro">${colunas}</div>${painel2()}</div>${canceladas ? `<p class="imp2-nota">${plural(canceladas, 'cancelada', 'canceladas')} nos últimos 90 dias: veja na vista Lista.</p>` : ''}`;
  }
  // A ficha (ou o formulário) ao lado, numa folha que rola por dentro: nas vistas Etapas e Lista.
  const painel2 = () => (st.form ? `<aside class="d3m-c-folha imp2-painel" aria-label="${st.form.id ? 'Editar impressão' : 'Nova impressão'}">${formulario()}</aside>` : st.sel ? `<div class="d3m-c-folha imp2-painel">${ficha()}</div>` : '');

  // ---------- Lista ----------
  function vistaLista2(abertas, doMes) {
    const { todas, aba, lista } = daAba2(), d = st.dados, din = d.gestao;
    const linha = (i) => `<div class="imp2-tl${String(i.id) === st.sel ? ' aberta' : ''}" data-vi-linha="${esc(i.id)}">${foto2(i.cliente_nome)}<span class="imp2-oq">${i.cliente_nome ? `<b>${esc(i.cliente_nome)}</b>` : ''}<button type="button" class="imp2-nome" data-vi-abrir="${esc(i.id)}">${esc(i.titulo)}</button></span>
      <span class="imp2-c">${esc(qtd2(i) || '')}</span>${etapa2(i)}<span class="imp2-c">${grafica2(i)}</span><span class="imp2-c${i.pedido_em ? '' : ' m'}">${i.pedido_em ? esc(br(i.pedido_em)) : 'sem pedido'}</span><span class="imp2-c">${entrega2(i)}</span>
      ${din ? `<span class="imp2-v${i.valor == null ? ' m' : ''}">${i.valor == null ? 'sem valor' : esc(reais(i.valor))}</span>` : ''}<span class="imp2-c">${i.conteudo_id ? `<button type="button" class="imp2-arte" data-vi-arte="${esc(i.conteudo_id)}" title="Abrir a arte">${esc(i.demanda_status || 'Na esteira')}</button>` : '<span class="m">sem arte ligada</span>'}</span></div>`;
    const mes = new Date(String(d.hoje || new Date().toISOString()).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const soma = (l) => l.reduce((s, i) => s + (Number(i.valor) || 0), 0), semG = abertas.filter((i) => !i.fornecedor_id).length, atras = abertas.filter((i) => i.atrasada).length;
    const somas = `${din ? `<span><b>${esc(reais(soma(doMes)))}</b> entregue no mês</span><span><b>${esc(reais(soma(abertas)))}</b> em aberto</span>` : `<span><b>${doMes.length}</b> ${doMes.length === 1 ? 'entregue' : 'entregues'} no mês</span>`}
      <button type="button" class="${semG ? 'a' : ''}" role="switch" aria-checked="${st.filtro === 'semfornecedor'}" data-vi-filtro="${st.filtro === 'semfornecedor' ? '' : 'semfornecedor'}"><b>${semG}</b> sem gráfica</button><button type="button" class="${atras ? 'r' : ''}" role="switch" aria-checked="${st.filtro === 'atrasadas'}" data-vi-filtro="${st.filtro === 'atrasadas' ? '' : 'atrasadas'}"><b>${atras}</b> ${atras === 1 ? 'atrasada' : 'atrasadas'}</button>`;
    return `<div class="d3m-c-corpo imp2 imp2-t${din ? '' : ' semv'}${st.sel || st.form ? '' : ' um'}"><section class="d3m-c-folha imp2-folha" aria-label="Impressões"><div class="d3m-c-folha-cab"><b class="d3m-c-h3" role="heading" aria-level="3">${plural(todas.length, 'impressão', 'impressões')} <span>· ${todas.filter(ABERTAS).length} abertas e ${doMes.length} ${doMes.length === 1 ? 'entregue' : 'entregues'} em ${esc(mes)}</span></b>${abas2(todas, aba, true)}</div>
      <div class="imp2-tcab" aria-hidden="true"><span></span><span>Cliente e peça</span><span>Quantidade</span><span>Etapa</span><span>Gráfica</span><span>Pedido</span><span>Entrega</span>${din ? '<span>Valor</span>' : ''}<span>A arte na esteira</span></div>
      <div class="imp2-lista">${lista.map(linha).join('') || vazio2(todas)}</div><div class="imp2-pe"><span class="imp2-pe-rot">Somas</span>${somas}</div></section>${painel2()}</div>`;
  }

  function corpo2() {
    if (!st.dados && !st.erro) return '<div class="d3m-c-folha d3v-estado" role="status"><b>Carregando as impressões</b></div>';
    if (st.erro && !st.dados) return `<div class="d3m-c-folha d3v-estado erro" role="alert"><b>Não deu para abrir Impressões</b>${esc(st.erro)}<button type="button" class="d3v-btn sec" data-vi="recarregar">Tentar de novo</button></div>`;
    const d = st.dados, todas = d.impressoes || [], abertas = todas.filter(ABERTAS), mesIso = String(d.hoje || new Date().toISOString()).slice(0, 7);
    const doMes = todas.filter((i) => i.etapa === 'entregue' && String(i.entregue_em || '').slice(0, 7) === mesIso);
    return st.vista === 'etapas' ? vistaEtapas2(abertas, doMes) : st.vista === 'lista' ? vistaLista2(abertas, doMes) : vistaLinhas2(abertas, doMes);
  }
  function pintarV2() {
    const d = st.dados, abertas = (d?.impressoes || []).filter(ABERTAS), naG = abertas.filter((i) => NA_GRAFICA.includes(i.etapa)).length, prontas = abertas.filter((i) => i.etapa === 'pronto').length;
    st.janela.classList.add('d3m-c-janela');
    const sub = !d ? (st.erro ? 'não deu para abrir' : 'carregando as impressões') : st.vista === 'etapas' ? `${plural(abertas.length, 'aberta', 'abertas')} · arrastar o cartão muda a etapa · sem gráfica não passa do orçamento`
      : st.vista === 'lista' ? `a tabela inteira, com pedido${d.gestao ? ', valor' : ''} e a arte na esteira` : `${plural(abertas.length, 'aberta', 'abertas')} · ${naG} na gráfica · ${prontas ? plural(prontas, 'pronta para retirar', 'prontas para retirar') : 'nenhuma pronta para retirar'}`;
    const vista = (k, r) => `<button type="button" role="radio" data-vi-vista="${k}" aria-checked="${st.vista === k}">${r}</button>`;
    const fNome = st.fornecedor ? (d?.fornecedores || []).find((f) => String(f.id) === st.fornecedor)?.nome || 'gráfica' : '';
    const filtrado = Boolean(st.filtro || st.fornecedor || st.todas);
    const sw = (attrs, on, t) => `<button type="button" role="menuitemcheckbox" aria-checked="${on}" ${attrs}>${t}</button>`;
    const mais = `<details class="d3m-c-menu"><summary class="d3m-c-ico${filtrado ? ' on' : ''}" aria-label="Filtros e histórico" title="Filtros e histórico">${IC2.pontos}</summary><div class="d3m-c-pop dir" role="menu" aria-label="Filtros e histórico">
        <span class="d3m-c-pop-rot">Mostrar só</span>${sw(`data-vi-filtro="${st.filtro === 'atrasadas' ? '' : 'atrasadas'}"`, st.filtro === 'atrasadas', 'Atrasadas')}${sw(`data-vi-filtro="${st.filtro === 'semfornecedor' ? '' : 'semfornecedor'}"`, st.filtro === 'semfornecedor', 'Sem gráfica')}
        ${fNome ? sw('data-vi-fornecedor=""', true, `Só ${esc(fNome)}`) : ''}${sw('data-vi="todas"', st.todas, 'Histórico inteiro')}
        ${(d?.ranking || []).length ? `<span class="d3m-c-pop-rot">Ranking das gráficas</span>${d.ranking.slice(0, 6).map((f) => `<button type="button" role="menuitemcheckbox" aria-checked="${String(f.fornecedor_id) === st.fornecedor}" data-vi-fornecedor="${esc(f.fornecedor_id)}" title="${esc(f.motivo || '')}">${esc(f.nome)}<small class="d3m-c-s">${esc([`${f.entregues} ${f.entregues === 1 ? 'entregue' : 'entregues'}`, f.pontualidade != null ? `${f.pontualidade}% no prazo` : ''].filter(Boolean).join(' · '))}</small></button>`).join('')}` : ''}</div></details>`;
    const titulo = typeof window.d3mcTrocaHtml === 'function' ? window.d3mcTrocaHtml('Impressões', 'producao', 'impressoes').replace('class="d3m-c-h"', 'class="d3m-c-h" id="vi-titulo"') : '<b class="d3m-c-h" id="vi-titulo" role="heading" aria-level="2">Impressões</b>';
    const tinha = st.janela.querySelector('.imp2-lista, .imp2-quadro')?.scrollTop || 0, foco = document.activeElement?.id === 'vi-busca';
    st.janela.innerHTML = `<div class="d3m-c-topo"><div class="d3m-c-tit">${titulo}<span class="d3m-c-sub">${esc(sub)}</span></div>
        <span class="d3m-c-seg" role="radiogroup" aria-label="Ver como">${vista('linhas', 'Linhas')}${vista('etapas', 'Etapas')}${vista('lista', 'Lista')}</span>
        <label class="d3m-c-busca" title="Buscar peça, cliente ou gráfica">${IC2.lupa}<input id="vi-busca" type="search" aria-label="Buscar peça, cliente ou gráfica" autocomplete="off" placeholder="Buscar peça, cliente ou gráfica" data-vi-busca value="${esc(st.busca)}"></label>${mais}
        <button type="button" class="d3m-c-btn" data-vi="nova">${IC2.mais}Nova impressão</button><button type="button" class="d3m-c-ico" data-vi="fechar" aria-label="Fechar" title="Fechar">${IC2.x}</button></div>
      <p class="vi-aviso imp2-aviso" role="status"></p>${corpo2()}`;
    pintarAviso();
    const l = st.janela.querySelector('.imp2-lista, .imp2-quadro'); if (l) l.scrollTop = tinha;
    if (foco) { const b = st.janela.querySelector('#vi-busca'); b?.focus(); try { b?.setSelectionRange(b.value.length, b.value.length); } catch { /* campo sem seleção */ } }
  }
  // Arrastar o cartão de uma coluna para outra muda a etapa (vista Etapas): o mesmo pedido do botão de avançar.
  function aoArrastar(e) { const c = e.target.closest?.('[data-vi-arrasta]'); if (!c) return; e.dataTransfer.setData('text/vybe-impressao', c.dataset.viArrasta); e.dataTransfer.effectAllowed = 'move'; }
  function aoPassar(e) { const col = e.target.closest?.('[data-vi-solta]'); if (!col || ![...(e.dataTransfer?.types || [])].includes('text/vybe-impressao')) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('alvo'); }
  function aoSair(e) { e.target.closest?.('[data-vi-solta]')?.classList.remove('alvo'); }
  function aoSoltar(e) {
    const col = e.target.closest?.('[data-vi-solta]'), id = e.dataTransfer?.getData('text/vybe-impressao'); if (!col || !id) return;
    e.preventDefault(); col.classList.remove('alvo');
    const i = (st.dados?.impressoes || []).find((x) => String(x.id) === id), para = col.dataset.viSolta; if (!i || i.etapa === para) return;
    if (['arquivo_enviado', 'em_impressao', 'pronto', 'entregue'].includes(para) && !i.fornecedor_id) { st.aviso = 'Sem gráfica a impressão não passa do orçamento: escolha a gráfica primeiro.'; pintarAviso(true); return; }
    st.sel = id; gravar({ acao: 'impressao_etapa', id, etapa: para }, `Foi para ${etapaNome(para)}.`);
  }

  function pintar() {
    if (!st.janela) return;
    // Direção V2 (pranchas V2-M-Impressoes): no computador, o esqueleto novo (pintarV2, logo acima).
    if (v2()) return pintarV2();
    st.janela.classList?.remove('d3m-c-janela');
    const tinha = st.janela.scrollTop || 0;
    st.janela.innerHTML = `<div class="vi-topo vb-janela-topo">${cabecalho({ id: 'vi-titulo', titulo: 'Impressões',
      acoes: `<span class="vi-topo-acoes">${st.dados && !st.form && (st.dados.impressoes || []).length ? '<button type="button" class="p2-btn d3im-nova" data-vi="nova">+ Nova impressão</button>' : ''}${botaoX('data-vi="fechar"', 'vi-x')}</span>` })}</div>
      <p class="vi-aviso" role="status"></p><div class="vi-corpo">${corpo()}</div>`;
    pintarAviso();
    st.janela.scrollTop = tinha;
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
    const ef = e.target.closest('[data-vi-escolher-forn]');
    if (ef) { const i = st.dados.impressoes.find((x) => String(x.id) === ef.dataset.viEscolherForn); if (i) { st.sel = String(i.id); st.form = { ...i }; pintar(); st.janela.querySelector('[name=fornecedor_id], [data-vi="cadastrar-fornecedor"]')?.focus(); } return; }
    const b = e.target.closest('button');
    if (!b) { const l = e.target.closest('[data-vi-linha]'); if (l && !e.target.closest('a,input,select,textarea,label')) { st.sel = st.sel === l.dataset.viLinha ? '' : l.dataset.viLinha; st.cancelar = false; pintar(); } return; }
    if (b.disabled) return;
    if (b.dataset.viVista) { st.vista = b.dataset.viVista; st.aba = ''; pintar(); return; }
    if (b.dataset.viAba) { st.aba = b.dataset.viAba; pintar(); return; }
    if (b.dataset.viDecidir) { decidir(b.dataset.viDecidir); return; }
    if (b.dataset.viAbrir) { st.sel = st.sel === b.dataset.viAbrir && st.vista === 'linhas' ? '' : b.dataset.viAbrir; st.cancelar = false; pintar(); st.janela.querySelector('.vi2-item.sel')?.scrollIntoView?.({ block: 'nearest' }); return; }
    if (b.dataset.viFiltro !== undefined) { st.filtro = b.dataset.viFiltro; pintar(); return; }
    if (b.dataset.viFornecedor !== undefined) { st.fornecedor = st.fornecedor === b.dataset.viFornecedor ? '' : b.dataset.viFornecedor; pintar(); return; }
    if (b.dataset.viArte) { const id = String(b.dataset.viArte); window.openItemWorkspace?.(id.startsWith('vybe:') ? id : 'vybe:' + id); return; }
    if (b.dataset.viUsar) { const i = st.dados.impressoes.find((x) => String(x.id) === st.sel); st.form = { ...i, fornecedor_id: b.dataset.viUsar }; pintar(); st.janela.querySelector('[name=fornecedor_id]')?.focus(); return; }
    if (b.dataset.viEscolher) { gravar({ acao: 'cotacao_escolher', id: b.dataset.viEscolher }, 'Cotação escolhida: fornecedor, valor e previsão foram para a impressão.'); return; }
    if (b.dataset.viEtapa) { if (b.dataset.viId) st.sel = b.dataset.viId; if (b.classList.contains('v2-estado')) b.dataset.estado = 'indo'; gravar({ acao: 'impressao_etapa', id: st.sel, etapa: b.dataset.viEtapa }, `Foi para ${etapaNome(b.dataset.viEtapa)}.`); return; }
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
    else if (a === 'todas') { st.todas = !st.todas; carregar(); }
    else if (a === 'cotar') { st.cotar = true; pintar(); st.janela.querySelector('[data-vi-form=cotacao] select')?.focus(); }
    else if (a === 'nao-cotar') { st.cotar = false; pintar(); }
    else if (a === 'filtros') { st.filtros = !st.filtros; pintar(); }
    else if (a === 'por-grafica') { st.porGrafica = !st.porGrafica; pintar(); }
    else if (a === 'mais') { st.mais = !st.mais; pintarLinhas(); }
    else if (a === 'deck-lista') { st.deckLista = !st.deckLista; pintar(); }
    else if (a === 'anterior' || a === 'proxima') passar(a === 'proxima' ? 1 : -1);
    else if (a === 'agora-nao') { const x = decisoes()[st.deck]; if (x) { st.pulou.add(x.chave); pintar(); } }
  }
  function aoMudar(e) {
    const m = e.target.closest('[data-vi-mover]'); if (m) { const para = m.value; m.value = ''; if (para) gravar({ acao: 'impressao_etapa', id: st.sel, etapa: para }, `Foi para ${etapaNome(para)}.`); return; }
    const c = e.target.closest('[data-vi-cliente]'); if (c && st.form) { const f = e.target.form; st.form = { ...st.form, ...formParaObjeto(f), cliente_id: c.value || null, projeto_id: null }; pintar(); }
  }
  function aoEnviar(e) {
    const form = e.target.closest('[data-vi-form]'); if (!form) return; e.preventDefault();
    if (form.dataset.viForm === 'cotacao') {
      const o = Object.fromEntries(new FormData(form).entries());
      gravar({ acao: 'cotacao_salvar', impressao_id: st.sel, fornecedor_id: o.fornecedor_id, valor: Number(o.valor), prazo_dias: o.prazo_dias === '' ? null : Number(o.prazo_dias), observacao: o.observacao || '' }, 'Cotação guardada.');
      return;
    }
    if (form.dataset.viForm === 'cancelar') { const nota = String(new FormData(form).get('nota') || '').trim(); if (!nota) return; gravar({ acao: 'impressao_etapa', id: st.sel, etapa: 'cancelado', nota }, 'Impressão cancelada.'); return; }
    const o = formParaObjeto(form), id = st.form?.id;
    gravar({ acao: 'impressao_salvar', ...(id ? { id } : {}), ...o }, id ? 'Impressão salva.' : 'Impressão criada.');
  }
  function aoDigitar(e) { if (e.target.matches?.('[data-vi-busca]')) { st.busca = e.target.value; pintarLinhas(); } }
  function aoTeclar(e) {
    if (st.raiz && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest?.('input,textarea,select') && !document.querySelector('dialog[open], #workspace-drawer.open')) { passar(e.key === 'ArrowRight' ? 1 : -1); return; }
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
      raiz.addEventListener('click', aoClicar); raiz.addEventListener('change', aoMudar); raiz.addEventListener('submit', aoEnviar); raiz.addEventListener('input', aoDigitar);
      raiz.addEventListener('dragstart', aoArrastar); raiz.addEventListener('dragover', aoPassar); raiz.addEventListener('dragleave', aoSair); raiz.addEventListener('drop', aoSoltar);
      document.body.append(raiz);
      Object.assign(st, { raiz, janela });
    }
    pintar(); carregar();
  }
  function fechar() {
    const { raiz, antes } = st; if (!raiz) return;
    Object.assign(st, { raiz: null, janela: null, antes: null, aviso: '', form: null, sel: '', cancelar: false, busca: '', mais: false, deck: 0, deckLista: false, pulou: new Set() });
    raiz.remove(); if (antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclar, true);
  // Sala de Compras (andar Financeiro, Nestor): modulo { tipo: 'janela', alvo: 'impressoes' } na planta (mundo/planta.mjs).
  document.addEventListener?.('click', (e) => {
    const b = e.target.closest?.('[data-modulo]'); if (!b) return;
    let m; try { m = JSON.parse(b.dataset.modulo); } catch { return; }
    if (m?.tipo !== 'janela' || m.alvo !== 'impressoes') return;
    e.preventDefault(); e.stopPropagation(); abrir();
  }, true);
  window.VybeImpressoes = Object.freeze({ abrir, fechar, aberto: () => Boolean(st.raiz) });
})();
