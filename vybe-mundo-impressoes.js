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
    && (st.filtro === 'atrasadas' ? i.atrasada : st.filtro === 'semfornecedor' ? !i.fornecedor_id && ABERTAS(i) : true));
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
  function baralhoHtml(lista) {
    const n = lista.length; st.deck = Math.min(Math.max(0, st.deck), n - 1);
    const cabeca = `<div class="p2-lista-topo vi2-pede-topo"><h3 class="p2-h">Pede ação</h3><span class="p2-sub">${n} ${n === 1 ? 'decisão espera' : 'decisões esperam'} o seu ok</span></div>`;
    if (st.deckLista) return `<div class="vi2-pede">${cabeca}<div class="p2-card vi2-deck-lista">${lista.map((x, k) => `<div class="p2-lin"><p><b>${esc(x.i.titulo)}</b><br><span class="p2-sub">${x.tipo === 'cotacao' ? `${esc(x.c.fornecedor_nome || 'Fornecedor')} · ${esc(reais(x.c.valor))}` : `sugerida: ${esc(x.s.nome)}`}</span></p><button type="button" class="p2-btn s k" data-vi-decidir="${k}">Aprovar</button></div>`).join('')}
        <p class="p2-sub p2-pe"><button type="button" class="p2-link" data-vi="deck-lista">ver um por vez</button></p></div></div>`;
    return `<div class="vi2-pede">${cabeca}<div class="v2-baralho vi2-baralho" aria-live="polite">${lista.map(cartaHtml).join('')}</div>
      <div class="vi2-decide"><button type="button" class="p2-btn" data-vi="agora-nao">Agora não</button><button type="button" class="p2-btn k v2-estado" data-vi-decidir="atual">Aprovar</button></div>
      <div class="vi2-conta"><span class="v2-pontos" aria-hidden="true">${lista.map((_, k) => `<i${k === st.deck ? ' class="on"' : ''}></i>`).join('')}</span><span class="p2-sub"><span data-vi-conta>${st.deck + 1} de ${n}</span>${n > 1 ? ' · seta para os lados passa' : ''} · <button type="button" class="p2-link" data-vi="deck-lista">ver em lista</button></span></div></div>`;
  }
  // As setas só mexem nas posições: o cartão da frente sai e o de trás vem, sem redesenhar a janela.
  function passar(n) {
    const total = decisoes().length; if (!total || st.deckLista) return;
    st.deck = Math.min(Math.max(0, st.deck + n), total - 1);
    st.janela?.querySelectorAll('[data-vi-carta]').forEach((c) => { const pos = Number(c.dataset.viCarta) - st.deck; if (pos < 0) c.dataset.pos = 'fora'; else if (pos <= 2) c.dataset.pos = String(pos); else delete c.dataset.pos; });
    st.janela?.querySelectorAll('.v2-pontos > i').forEach((p, k) => p.classList.toggle('on', k === st.deck));
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
    const forn = i.fornecedor_nome ? esc(i.fornecedor_nome) : `<b class="atencao">sem fornecedor</b>${ABERTAS(i) ? ` · <button type="button" class="p2-link vi-escolher" data-vi-escolher-forn="${esc(i.id)}">escolher</button>` : ''}`;
    return `<div class="v2-abre p2-abre vi2-item${aberta ? ' sel' : ''}" aria-expanded="${aberta}"><div class="p2-lin"><div class="vi2-meio" data-vi-linha="${esc(i.id)}">
        <p class="vi2-l1"><span>${cliPonto(i.cliente_nome) || '<span class="p2-sub">interno</span>'} · <button type="button" class="vi2-nome" data-vi-abrir="${esc(i.id)}" aria-expanded="${aberta}">${esc(i.titulo)}</button>${unidades(i) ? ` · ${esc(unidades(i))}` : ''}</span>${i.atrasada ? `<span class="p2-pill r">${diasDeAtraso(i) ? `${diasDeAtraso(i)} ${diasDeAtraso(i) === 1 ? 'dia' : 'dias'}` : 'atrasada'}</span>` : i.previsao ? `<span class="p2-sub">${esc(diaSem(i.previsao))}</span>` : ''}</p>
        <div class="vi2-l2">${trilhaHtml(i)}<span class="vi2-onde">${esc(etapaNome(i.etapa))} · ${forn}</span>${i.atrasada && podeAvancar ? `<button type="button" class="p2-btn s v2-estado" data-vi-etapa="${esc(prox.id)}" data-vi-id="${esc(i.id)}">Marcar como ${esc(String(prox.nome).toLowerCase())}</button>` : ''}</div>
      </div></div><div class="v2-mais"><div>${aberta ? ficha() : ''}</div></div></div>`;
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
    return `${lista.map(linhaHtml).join('')}${pe || st.mais ? `<p class="p2-sub p2-pe vi2-pe">${pe}${pe ? ' · ' : ''}<button type="button" class="p2-link" data-vi="mais">${st.mais ? 'recolher' : 'mostrar'}</button></p>` : ''}`;
  }
  const vistaHtml = () => (st.vista === 'etapas' ? quadro() + ficha() : st.vista === 'lista' ? listaHtml() + ficha() : linhasHtml());
  function pintarLinhas() { const c = st.janela?.querySelector('.vi2-linhas'); if (c) c.innerHTML = vistaHtml(); }
  function corpo() {
    if (!st.dados && !st.erro) return estado('carregando', 'Carregando as impressões', '');
    if (st.erro && !st.dados) return estado('erro', 'Não deu para abrir Impressões', st.erro, '<button type="button" class="p2-btn s" data-vi="recarregar">Tentar de novo</button>');
    const d = st.dados, R = d.resumo || {}, todas = d.impressoes || [], abertas = todas.filter(ABERTAS);
    if (!todas.length) return `${st.form ? `<div class="p2-card">${formulario()}</div>` : ''}<div class="p2-card vi2-vazio"><p><b>Nenhuma impressão ainda.</b> <span class="p2-sub">Adesivo, banner, cardápio, embalagem: acompanhe da arte à entrega na gráfica.</span></p>${st.form ? '' : '<button type="button" class="p2-btn s" data-vi="nova">Nova impressão</button>'}</div>`;
    const chip = (k, rot, n) => `<button type="button" class="p2-chip vi-chip" data-vi-filtro="${k}" aria-pressed="${st.filtro === k}">${rot}${n != null ? ` <b>${n}</b>` : ''}</button>`;
    const fNome = st.fornecedor ? (d.fornecedores || []).find((f) => String(f.id) === st.fornecedor)?.nome || 'fornecedor' : '';
    const vista = (k, r) => `<button type="button" data-vi-vista="${k}" aria-pressed="${st.vista === k}">${r}</button>`;
    // A frase e os números saem das mesmas impressões da lista.
    const atrasadas = abertas.filter((i) => i.atrasada), semForn = abertas.filter((i) => !i.fornecedor_id);
    const urgente = atrasadas[0] || abertas.filter((i) => i.previsao).sort((a, b) => String(a.previsao).localeCompare(String(b.previsao)))[0] || null;
    const nA = R.abertas ?? abertas.length, nAt = R.atrasadas ?? atrasadas.length, nS = R.semFornecedor ?? semForn.length;
    const fala = `<div class="p2-card p2-fala"><span class="p2-ag" aria-hidden="true">N</span>
      <p><span class="p2-quem">Nestor · Compras, fornecedores e impressões</span><b>${nA} ${nA === 1 ? 'impressão aberta' : 'impressões abertas'}.</b> ${nAt ? `${nAt} ${nAt === 1 ? 'atrasada' : 'atrasadas'} na gráfica` : 'Nenhuma atrasada'}${nS ? ` e <b>${nS} sem fornecedor</b>` : ''}.${urgente ? ` ${esc(urgente.titulo)}${urgente.cliente_nome ? ` de ${esc(urgente.cliente_nome)}` : ''} é a mais urgente: ${urgente.atrasada ? `a entrega era ${esc(diaSem(urgente.previsao))}` : `a entrega é ${esc(diaSem(urgente.previsao))}`}.` : ''}</p>
      ${urgente ? `<button type="button" class="p2-btn s" data-vi-abrir="${esc(urgente.id)}">Ver ${esc(String(urgente.titulo).length > 22 ? 'a mais urgente' : urgente.titulo)}</button>` : ''}</div>`;
    const porEtapa = etapasDoCaminho().map((e) => { const n = abertas.filter((i) => i.etapa === e.id).length; return n ? `${n} em ${String(e.nome).toLowerCase()}` : ''; }).filter(Boolean).slice(0, 3).join(' · ');
    const nomes = (l) => l.slice(0, 2).map((i) => String(i.titulo).toLowerCase()).join(' e ') + (l.length > 2 ? ` e mais ${l.length - 2}` : '');
    const kpis = `<div class="p2-kpis">
      <div class="p2-card p2-kpi${nA ? '' : ' quieto'}"><small>Abertas</small><b><span class="v2-num">${nA}</span></b><small>${esc(porEtapa || 'nada em andamento')}</small></div>
      <div class="p2-card p2-kpi${nAt ? ' ruim' : ' quieto'}"><small>Atrasadas</small><b><span class="v2-num" style="animation-delay:.12s">${nAt}</span></b><small>${atrasadas[0] ? `${esc(String(atrasadas[0].titulo).toLowerCase())}${atrasadas[0].cliente_nome ? ` de ${esc(atrasadas[0].cliente_nome)}` : ''}${diasDeAtraso(atrasadas[0]) ? `, há ${diasDeAtraso(atrasadas[0])} ${diasDeAtraso(atrasadas[0]) === 1 ? 'dia' : 'dias'}` : ''}` : 'tudo dentro da previsão'}</small></div>
      <div class="p2-card p2-kpi${nS ? ' atencao' : ' quieto'}"><small>Sem fornecedor</small><b><span class="v2-num" style="animation-delay:.24s">${nS}</span></b><small>${semForn.length ? esc(nomes(semForn)) : 'todas com gráfica'}</small></div></div>`;
    const dec = decisoes();
    const filtrosMais = st.filtros ? `<div class="vi2-filtros-mais"><div class="p2-filtros"><span class="p2-sub">Ver como</span><span class="p2-seg vi-vista" role="group" aria-label="Ver como">${vista('linhas', 'Linhas')}${vista('etapas', 'Etapas')}${vista('lista', 'Tabela')}</span></div>${porFornecedor()}</div>` : '';
    return `${fala}${kpis}${st.form ? `<div class="p2-card">${formulario()}</div>` : ''}
      <div class="vi2-duas${dec.length ? '' : ' so-lista'}">${dec.length ? baralhoHtml(dec) : ''}
        <div class="p2-card vi2-lista">
          <div class="p2-filtros"><label class="p2-oculto" for="vi-busca">Buscar peça, cliente ou fornecedor</label><input id="vi-busca" class="p2-busca" type="search" placeholder="Buscar peça, cliente ou fornecedor" data-vi-busca value="${esc(st.busca)}">
            <button type="button" class="p2-btn s" data-vi="filtros" aria-expanded="${st.filtros}"${st.filtros ? ' aria-pressed="true"' : ''}>Filtros</button></div>
          <div class="p2-filtros vi-filtros" role="group" aria-label="Filtrar">${chip('', 'Abertas', nA)}${chip('atrasadas', 'Atrasadas', nAt)}${chip('semfornecedor', 'Sem fornecedor', nS)}
            ${fNome ? `<button type="button" class="p2-chip" data-vi-fornecedor="" aria-pressed="true">${esc(fNome)} ✕</button>` : ''}
            <button type="button" class="p2-chip" data-vi="todas" aria-pressed="${st.todas}" title="Sem marcar, as entregues e canceladas aparecem só dos últimos 90 dias">Histórico inteiro</button></div>
          ${filtrosMais}
          <div class="vi2-linhas">${vistaHtml()}</div>
        </div></div>`;
  }
  function pintar() {
    if (!st.janela) return;
    const tinha = st.janela.scrollTop || 0;
    st.janela.innerHTML = `<div class="vi-topo vb-janela-topo">${cabecalho({ id: 'vi-titulo', titulo: 'Impressões',
      acoes: `<span class="vi-topo-acoes">${st.dados && !st.form ? '<button type="button" class="p2-btn p" data-vi="nova">Nova impressão</button>' : ''}${botaoX('data-vi="fechar"', 'vi-x')}</span>` })}</div>
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
    if (b.dataset.viVista) { st.vista = b.dataset.viVista; pintar(); return; }
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
    else if (a === 'mais') { st.mais = !st.mais; pintarLinhas(); }
    else if (a === 'deck-lista') { st.deckLista = !st.deckLista; pintar(); }
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
