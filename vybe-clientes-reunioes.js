// vybe-clientes-reunioes.js — Reuniões e onboarding na ficha do cliente (Paulo, 09/11/2026).
//
// Aba Reuniões: cada reunião ligada ao cliente, com tipo, pauta (o sistema sugere com o que já sabe do cliente), ata em
// texto e gravação. A gravação roda numa barra flutuante (dá para continuar usando o sistema e escrever a ata) e sobe
// para a pasta "Reuniões" do cliente no Drive em partes; a transcrição e as demandas sugeridas vêm do bot depois.
// Aba Onboarding: as respostas do questionário, a SWOT e o link que serve tanto para o cliente preencher sozinho quanto
// para preencher junto com ele na reunião. Servidor: server/reunioes.js (area=reunioes, /onboarding/<código>).
(() => {
  const esc = (s) => (typeof safeText === 'function' ? safeText(String(s ?? '')) : String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const asp = (s) => esc(String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  const dados = {}; // clienteId → { carregando, d, erro }
  const dataBr = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');
  const hojeIso = () => new Date(Date.now() - 3 * 36e5).toISOString().slice(0, 10);

  async function carregar(id, forcar = false) {
    if (dados[id] && !forcar && (dados[id].d || dados[id].carregando)) return dados[id].promessa;
    let fim; const promessa = new Promise((ok) => { fim = ok; });
    dados[id] = { carregando: true, promessa };
    try {
      const r = await fetch(`/api/painel?area=reunioes&cliente=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não consegui ler as reuniões.');
      dados[id] = { d };
    } catch (e) { dados[id] = { erro: e.message }; }
    fim();
    repintar(id);
  }
  // Repinta a ficha aberta (só quando a leitura é do cliente dela) e a tela Reuniões, se estiver aberta.
  const repintar = (id) => {
    if (typeof CLIENTE_ABERTO === 'string' && CLIENTE_ABERTO && typeof renderClientMasterDetail === 'function'
      && (id === undefined || typeof idDoCliente !== 'function' || String(idDoCliente(CLIENTE_ABERTO) || '') === String(id))) renderClientMasterDetail(CLIENTE_ABERTO);
    if (tela.janela) pintarTela();
  };
  const dadosDe = (id) => dados[id]?.d || null;
  async function postar(corpo) {
    const r = await fetch('/api/painel?area=reunioes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Não foi possível salvar.');
    return d;
  }

  // ── aba Reuniões ───────────────────────────────────────────────────────────
  function reunioesHtml(nome) {
    const id = String(idDoCliente(nome) || '');
    if (!id) return '<div class="client-master-detail-card"><p>Este cliente ainda não tem ficha própria. Crie a ficha para registrar reuniões.</p></div>';
    const e = dados[id];
    if (!e) { carregar(id); return '<div class="client-master-detail-card"><div class="auto-carregando">Lendo as reuniões…</div></div>'; }
    if (e.carregando) return '<div class="client-master-detail-card"><div class="auto-carregando">Lendo as reuniões…</div></div>';
    if (e.erro) return `<div class="client-master-detail-card"><p class="ciclo-erro">${esc(e.erro)}</p></div>`;
    const { reunioes = [], pauta = [], pode, tipos = {} } = e.d;
    const grav = gravando && gravando.clienteId === id;
    const lista = reunioes.length ? reunioes.map((r) => `<li class="reu-item"><details><summary>
        <span class="reu-tipo">${esc(tipos[r.tipo] || r.tipo)}</span><b>${esc(r.titulo)}</b>
        <small>${dataBr(r.data)}${r.participantes ? ' · ' + esc(r.participantes) : ''}${r.gravacao ? ' · 🎙️ gravada' : ''}${r.ata ? '' : ' · sem ata'}</small></summary>
        ${r.pauta ? `<h5>Pauta</h5><p>${esc(r.pauta).replace(/\n/g, '<br>')}</p>` : ''}
        ${r.ata ? `<h5>Ata</h5><p>${esc(r.ata).replace(/\n/g, '<br>')}</p>` : '<p class="cli-vazio">Ainda sem ata.</p>'}
        ${r.gravacao ? `<p><a class="cli-porta" href="https://drive.google.com/file/d/${esc(r.gravacao.id)}/view" target="_blank" rel="noopener">Ouvir a gravação no Drive ↗</a></p>` : ''}
        ${sugestoesHtml(r, pode)}
        ${r.transcricao ? `<h5>Transcrição</h5><p class="reu-transcricao">${esc(r.transcricao.slice(0, 4000)).replace(/\n/g, '<br>')}</p>` : r.gravacao ? '<p class="cli-vazio">A transcrição e as demandas sugeridas chegam aqui depois que o bot processar a gravação.</p>' : ''}
        ${pode ? `<div class="reu-acoes"><button type="button" class="vb-botao" onclick="abrirReuniao('${asp(nome)}','${esc(r.id)}')">Editar ata</button>
          ${r.gravacao ? '' : `<button type="button" class="vb-botao" ${gravando ? 'disabled' : ''} onclick="gravarReuniao('${esc(id)}','${esc(r.id)}','${asp(r.titulo)}')">● Gravar</button>`}</div>` : ''}
      </details></li>`).join('') : '<p class="cli-vazio">Nenhuma reunião registrada ainda.</p>';
    return `<div class="client-master-detail-card"><div class="cli-ficha-topo"><h3>Reuniões</h3>
        ${pode ? `<button type="button" class="vb-botao principal" onclick="abrirReuniao('${asp(nome)}')">Nova reunião</button>` : ''}</div>
      <p>Cada reunião fica aqui, com a pauta, a ata e a gravação.${grav ? ' <b>Gravando agora.</b>' : ''}</p>
      ${pauta.length ? `<div class="reu-pauta"><b>Pauta sugerida para a próxima</b><ul>${pauta.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
      <ul class="reu-lista">${lista}</ul></div>`;
  }

  // O que o bot tirou da gravação: resumo, decisões e demandas para marcar, ajustar e cadastrar no quadro de Solicitações.
  function sugestoesHtml(r, pode) {
    const s = r.sugestoes;
    if (!s) return r.estado === 'transcricao_falhou' ? '<p class="ciclo-erro">O bot não conseguiu transcrever esta gravação. Escreva a ata à mão.</p>' : '';
    const feitas = s.cadastradas || [];
    const dem = (s.demandas || []).map((d, i) => `<li class="reu-dem"><label><input type="checkbox" data-reu-dem="${i}" ${pode && !feitas.some((f) => f.titulo === d.titulo) ? 'checked' : 'disabled'}>
        <input type="text" data-reu-campo="titulo" data-i="${i}" value="${esc(d.titulo)}" ${pode ? '' : 'disabled'}></label>
        <span class="reu-dem-meta"><input type="text" data-reu-campo="formato" data-i="${i}" value="${esc(d.formato || '')}" placeholder="formato" ${pode ? '' : 'disabled'}>
        <input type="date" data-reu-campo="prazo" data-i="${i}" value="${esc(d.prazo || '')}" title="Prazo" ${pode ? '' : 'disabled'}>
        ${d.responsavel ? `<small>sugestão: ${esc(d.responsavel)}</small>` : ''}${feitas.some((f) => f.titulo === d.titulo) ? '<small class="ok">✓ cadastrada</small>' : ''}</span></li>`).join('');
    return `<div class="reu-sug" data-reu-sug="${esc(r.id)}"><h5>O que o bot tirou da reunião</h5>
      ${s.resumo ? `<p>${esc(s.resumo).replace(/\n/g, '<br>')}</p>` : ''}
      ${(s.decisoes || []).length ? `<b>Decisões</b><ul>${s.decisoes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      ${(s.demandas || []).length ? `<b>Demandas sugeridas</b><ul class="reu-dems">${dem}</ul>
        ${pode ? `<button type="button" class="vb-botao principal" onclick="cadastrarDemandasReuniao('${esc(r.cliente_id)}','${esc(r.id)}', this)">Cadastrar as marcadas em Solicitações</button>` : ''}` : '<p class="cli-vazio">Nenhuma demanda sugerida.</p>'}
      ${feitas.length ? `<p class="reu-ok">${feitas.length} demanda${feitas.length > 1 ? 's' : ''} já cadastrada${feitas.length > 1 ? 's' : ''}.</p>` : ''}</div>`;
  }
  window.cadastrarDemandasReuniao = async function cadastrarDemandasReuniao(clienteId, reuniaoId, botao) {
    const caixa = document.querySelector(`[data-reu-sug="${reuniaoId}"]`);
    const r = (dados[clienteId]?.d?.reunioes || []).find((x) => x.id === String(reuniaoId));
    if (!caixa || !r?.sugestoes) return;
    const escolhidas = [...caixa.querySelectorAll('[data-reu-dem]')].filter((c) => c.checked && !c.disabled).map((c) => {
      const i = c.dataset.reuDem, campo = (k) => caixa.querySelector(`[data-reu-campo="${k}"][data-i="${i}"]`)?.value || '';
      return { ...r.sugestoes.demandas[i], titulo: campo('titulo'), formato: campo('formato'), prazo: campo('prazo') };
    });
    if (!escolhidas.length) return showToast('Marque ao menos uma demanda.', 'warning', 4000);
    if (typeof confirmarNoPainel === 'function' && !await confirmarNoPainel(`Cadastrar ${escolhidas.length} demanda${escolhidas.length > 1 ? 's' : ''} em Solicitações para este cliente?`)) return;
    botao.disabled = true;
    try {
      const d = await postar({ acao: 'cadastrar-demandas', id: reuniaoId, demandas: escolhidas });
      showToast(`${d.criadas.length} demanda${d.criadas.length > 1 ? 's' : ''} cadastrada${d.criadas.length > 1 ? 's' : ''} em Solicitações.`, 'success', 5000);
      await carregar(clienteId, true);
      if (typeof refreshData === 'function') refreshData();
    } catch (e) { botao.disabled = false; showToast(e.message, 'error', 6000); }
  };

  // Lateral → Clientes → Reuniões, o kickoff do Onboarding e a aba Reuniões da ficha abrem este mesmo modal (Paulo,
  // 09/11/2026: "cadê o botão de reunião?… se eu quiser só abrir uma reunião e ter aquele fluxo do áudio"). Sem cliente,
  // o modal pede o cliente e traz a pauta sugerida dele ao escolher. opcoes: { tipo, titulo } para a reunião nova.
  const TIPOS_PADRAO = { rotina: 'Rotina com o cliente', onboarding: 'Onboarding / kickoff', alinhamento: 'Alinhamento', comercial: 'Comercial', interna: 'Interna' };
  const clientesAtivos = () => (typeof CADASTRO_CLIENTES === 'undefined' ? [] : CADASTRO_CLIENTES)
    .filter((c) => c && c.ativo !== false && c.id && c.nome).sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const pautaDe = (id) => (dados[id]?.d?.pauta || []).map((p) => '- ' + p).join('\n');
  window.abrirReuniao = async function abrirReuniao(nome = '', reuniaoId = '', opcoes = {}) {
    // Com a tela Reuniões aberta, o formulário dela e o desta janela usam os mesmos campos: um de cada vez.
    if (tela.janela && tela.form) {
      const rascunho = ['titulo', 'participantes', 'ata'].some((k) => (tela.janela.querySelector('#reu-' + k)?.value || '').trim());
      if (rascunho) return showToast('Salve ou cancele a Nova reunião antes de abrir outra.', 'warning', 5000);
      tela.form = false; pintarForm();
    }
    if (!nome && !clientesAtivos().length && typeof ensureClientMasterSources === 'function') {
      showToast('Carregando os clientes…', 'info', 2500);
      await ensureClientMasterSources(true).catch(() => null);
      if (!clientesAtivos().length) return showToast('A lista de clientes não carregou. Recarregue a página.', 'error', 6000);
    }
    const id = nome ? String(idDoCliente(nome) || '') : '';
    if (nome && !id) return showToast('Este cliente ainda não tem ficha própria. Crie a ficha para registrar reuniões.', 'warning', 5000);
    if (id && !dados[id]?.d) await carregar(id);
    const e = (id && dados[id]?.d) || {};
    const r = (e.reunioes || []).find((x) => x.id === String(reuniaoId)) || null;
    const tipos = e.tipos || TIPOS_PADRAO;
    const tipo = r?.tipo || opcoes.tipo || 'rotina';
    const pautaPadrao = r ? r.pauta : pautaDe(id);
    const escolha = nome ? '' : `<label class="cad-campo largo"><span>Cliente</span><select id="reu-cliente" onchange="trocarClienteDaReuniao(this.value)" required>
        <option value="">Escolha o cliente</option>${clientesAtivos().map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></label>`;
    // Cabeçalho único (quarta rodada, 11/11/2026): saiu o rótulo "Vybe OS · Reunião" de cima do título; o nome do
    // cliente, que vinha nele, vai no título. O X é o das outras janelas (vbFecharHtml).
    const tituloReu = (r ? 'Ata da reunião' : 'Nova reunião') + (nome ? ' · ' + nome : '');
    const fraseReu = r ? 'Escreva a ata durante ou depois da reunião.' : 'Salve e grave: o áudio vai para a pasta Reuniões do cliente no Drive, e o VYBES devolve a transcrição, o resumo e as demandas sugeridas na ficha.';
    const cabecalhoReu = typeof vbCabecalhoHtml === 'function' && typeof vbFecharHtml === 'function'
      ? vbCabecalhoHtml({ titulo: tituloReu, texto: fraseReu, acoes: vbFecharHtml('onclick="closeWorkflowModal()"') })
      : `<div class="workflow-kicker"><button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div><h2 class="workflow-title">${esc(tituloReu)}</h2><p class="workflow-copy">${fraseReu}</p>`;
    openWorkflowModal(`<div class="cad-janela cad-reuniao">${cabecalhoReu}
      <div class="cad-grade">${escolha}
        <label class="cad-campo"><span>Tipo</span><select id="reu-tipo">${Object.entries(tipos).map(([k, v]) => `<option value="${k}" ${tipo === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="cad-campo cad-data"><span>Data</span><input id="reu-data" type="date" value="${esc(r?.data || hojeIso())}"><svg class="cad-data-ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></label>
        <label class="cad-campo largo"><span>Título</span><input id="reu-titulo" maxlength="160" value="${esc(r?.titulo || opcoes.titulo || '')}" placeholder="Ex.: Entrada da Lil"></label>
        <label class="cad-campo largo"><span>Participantes</span><input id="reu-participantes" maxlength="600" value="${esc(r?.participantes || '')}" placeholder="Quem estava"></label>
        <label class="cad-campo largo"><span>Pauta</span><textarea id="reu-pauta" rows="5">${esc(pautaPadrao || '')}</textarea><small>Sugerida com o que o sistema sabe do cliente. Edite à vontade.</small></label>
        <label class="cad-campo largo"><span>Ata</span><textarea id="reu-ata" rows="10" placeholder="O que foi falado, o que ficou decidido, próximos passos e responsáveis">${esc(r?.ata || opcoes.ata || '')}</textarea></label>
      </div><p class="ciclo-erro" id="reu-erro" role="alert"></p>
      <div class="workflow-actions"><span class="cli-espaco"></span>
        <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
        ${!r?.gravacao ? `<button type="button" class="workflow-secondary" ${gravando ? 'disabled' : ''} onclick="salvarReuniao('${asp(nome)}','${esc(r?.id || '')}',true)">Salvar e gravar</button>` : ''}
        <button type="button" class="workflow-primary" onclick="salvarReuniao('${asp(nome)}','${esc(r?.id || '')}')">Salvar</button></div></div>`);
    document.getElementById('workflow-modal')?.classList.add('cad-modal');
    setTimeout(() => document.querySelector(nome ? '#reu-titulo' : '#reu-cliente')?.focus(), 40);
  };
  // Cliente escolhido no modal avulso: traz a pauta sugerida dele, se a pauta ainda não foi escrita.
  window.trocarClienteDaReuniao = async function trocarClienteDaReuniao(id) {
    const campo = document.getElementById('reu-pauta');
    if (!id || !campo) return;
    const antes = campo.value;
    await carregar(String(id));
    if (campo.isConnected && campo.value === antes && (!antes.trim() || campo.dataset.auto === '1')) { campo.value = pautaDe(String(id)); campo.dataset.auto = '1'; }
  };

  window.salvarReuniao = async function salvarReuniao(nome, reuniaoId, gravarDepois = false) {
    const id = String((nome ? idDoCliente(nome) : document.getElementById('reu-cliente')?.value) || '');
    const v = (k) => document.getElementById('reu-' + k)?.value || '';
    if (!id) { const er = document.getElementById('reu-erro'); if (er) er.textContent = 'Escolha o cliente da reunião.'; document.getElementById('reu-cliente')?.focus(); return; }
    try {
      const d = await postar({ acao: 'salvar', cliente: id, id: reuniaoId || undefined, tipo: v('tipo'), data: v('data'), titulo: v('titulo'), participantes: v('participantes'), pauta: v('pauta'), ata: v('ata') });
      closeWorkflowModal();
      showToast('Reunião salva.', 'success', 3500);
      if (tela.janela) pintarForm();
      await carregar(id, true);
      if (window.VybeCarteira?.aberto?.()) window.VybeCarteira.abrir('onboarding', { abas: ['onboarding'] });
      if (gravarDepois) gravarReuniao(id, d.reuniao.id, d.reuniao.titulo || (nome ? `Reunião - ${nome}` : 'Reunião'));
    } catch (e) { const er = document.getElementById('reu-erro'); if (er) er.textContent = e.message; else showToast(e.message, 'error', 6000); }
  };

  // ── gravação ───────────────────────────────────────────────────────────────
  let gravando = null; // { clienteId, reuniaoId, titulo, rec, partes, inicio, timer, stream }
  window.gravarReuniao = async function gravarReuniao(clienteId, reuniaoId, titulo) {
    if (gravando) return showToast('Já tem uma gravação em andamento.', 'warning', 4000);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return showToast('Este navegador não grava áudio. Use o Chrome ou o Safari atualizado.', 'error', 6000);
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch { return showToast('Sem permissão para usar o microfone.', 'error', 6000); }
    const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    const rec = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 32000 });
    gravando = { clienteId: String(clienteId), reuniaoId: String(reuniaoId), titulo, rec, partes: [], inicio: Date.now(), stream, tipo: rec.mimeType || tipo || 'audio/webm' };
    rec.ondataavailable = (ev) => { if (ev.data?.size) gravando?.partes.push(ev.data); };
    rec.start(10000);
    barra();
    gravando.timer = setInterval(barra, 1000);
    window.addEventListener('beforeunload', avisoSair);
    repintar();
  };
  const avisoSair = (ev) => { if (gravando) { ev.preventDefault(); ev.returnValue = ''; } };
  function barra(texto) {
    let el = document.getElementById('reu-barra');
    if (!gravando) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'reu-barra'; el.className = 'reu-barra'; el.setAttribute('role', 'status'); document.body.append(el); }
    const s = Math.floor((Date.now() - gravando.inicio) / 1000), t = `${String(Math.floor(s / 3600)).padStart(1, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    el.innerHTML = `<span class="reu-ponto" aria-hidden="true"></span><span><b>Gravando</b> · ${esc(gravando.titulo || 'reunião')} · ${t}${texto ? ' · ' + esc(texto) : ''}</span>
      <button type="button" class="workflow-primary" ${texto ? 'disabled' : ''} onclick="pararGravacao()">Parar e salvar</button>`;
  }
  window.pararGravacao = async function pararGravacao() {
    const g = gravando; if (!g) return;
    clearInterval(g.timer);
    await new Promise((ok) => { g.rec.onstop = ok; g.rec.stop(); });
    g.stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(g.partes, { type: g.tipo });
    const ext = /mp4/.test(g.tipo) ? 'm4a' : 'webm';
    const nome = `${hojeIso()} ${String(g.titulo || 'reuniao').replace(/[\\/:*?"<>|]/g, '-').slice(0, 80)}.${ext}`;
    try {
      barra('enviando 0%');
      const ab = await postar({ acao: 'gravacao', etapa: 'abrir', id: g.reuniaoId, nome, mime: g.tipo.split(';')[0], bytes: blob.size });
      const PARTE = 2 * 1024 * 1024; let fim = null;
      for (let inicio = 0; inicio < blob.size; inicio += PARTE) {
        const pedaco = new Uint8Array(await blob.slice(inicio, inicio + PARTE).arrayBuffer());
        let bin = ''; for (let i = 0; i < pedaco.length; i += 0x8000) bin += String.fromCharCode.apply(null, pedaco.subarray(i, i + 0x8000));
        const r = await postar({ acao: 'gravacao', etapa: 'parte', id: g.reuniaoId, contexto: ab.contexto, conteudo: btoa(bin), inicio });
        if (r.concluido) fim = r;
        barra(`enviando ${Math.min(100, Math.round(((inicio + pedaco.length) / blob.size) * 100))}%`);
      }
      if (!fim?.id) throw new Error('O Drive não confirmou o arquivo.');
      await postar({ acao: 'gravacao', etapa: 'registrar', id: g.reuniaoId, drive_file_id: fim.id, bytes: blob.size });
      showToast('Gravação salva na pasta Reuniões do cliente no Drive.', 'success', 5000);
      gravando = null; barra(); window.removeEventListener('beforeunload', avisoSair);
      await carregar(g.clienteId, true);
    } catch (e) {
      // Não perde o áudio: oferece baixar o arquivo para não ficar sem a reunião.
      const url = URL.createObjectURL(blob);
      showToast(`A gravação não subiu (${e.message}). Baixe o arquivo para não perder.`, 'error', 12000);
      const a = document.createElement('a'); a.href = url; a.download = nome; a.click();
      gravando = null; barra(); window.removeEventListener('beforeunload', avisoSair);
    }
  };

  // ── aba Onboarding ─────────────────────────────────────────────────────────
  const SECOES = [['negocio', 'Sobre o negócio'], ['marca', 'A marca']];
  function onboardingHtml(nome) {
    const id = String(idDoCliente(nome) || '');
    if (!id) return '<div class="client-master-detail-card"><p>Crie a ficha do cliente para fazer o onboarding.</p></div>';
    const e = dados[id];
    if (!e || e.carregando) { if (!e) carregar(id); return '<div class="client-master-detail-card"><div class="auto-carregando">Lendo o onboarding…</div></div>'; }
    if (e.erro) return `<div class="client-master-detail-card"><p class="ciclo-erro">${esc(e.erro)}</p></div>`;
    const { questoes = [], onboarding, pode } = e.d;
    const resp = onboarding?.respostas || {};
    const preenchidas = questoes.filter((q) => resp[q.chave]).length;
    const bloco = (secao) => questoes.filter((q) => q.secao === secao).map((q) => `<div class="${resp[q.chave] ? '' : 'falta'}"><dt>${esc(q.rotulo)}</dt><dd>${resp[q.chave] ? esc(resp[q.chave]).replace(/\n/g, '<br>') : '<span class="cli-vazio">—</span>'}</dd></div>`).join('');
    const swot = questoes.filter((q) => q.secao === 'swot').map((q) => `<div class="onb-swot-q onb-${q.chave}"><b>${esc(q.rotulo)}</b><p>${resp[q.chave] ? esc(resp[q.chave]).replace(/\n/g, '<br>') : '<span class="cli-vazio">—</span>'}</p></div>`).join('');
    return `<div class="client-master-detail-card"><div class="cli-ficha-topo"><h3>Onboarding de ${esc(nome)}</h3>
        ${pode ? `<span class="onb-botoes"><button type="button" class="vb-botao principal" onclick="abrirQuestionario('${esc(id)}','${asp(nome)}')">Preencher com o cliente agora</button>
          <button type="button" class="vb-botao" onclick="onboardingLink('${esc(id)}')">Link para o cliente</button></span>` : ''}</div>
      <p>${preenchidas} de ${questoes.length} perguntas respondidas${resp._atualizado_em ? ` · última vez em ${dataBr(resp._atualizado_em)}${resp._por === 'reuniao' ? ', na reunião' : ', pelo cliente'}` : ''}. O cadastro (empresa, responsável, canais) vai para a aba Cadastro; os acessos, para o cofre de Acessos.</p>
      ${SECOES.map(([s, t]) => `<section class="cad-leitura"><h4>${t}</h4><dl>${bloco(s)}</dl></section>`).join('')}
      <section class="cad-leitura"><h4>Análise SWOT</h4><div class="onb-swot">${swot}</div></section>
      <p class="onb-dica">A esteira (boas-vindas, contrato, acessos, kickoff, primeiro mês) e a reunião de kickoff ficam em Clientes → Onboarding, na lateral.</p></div>`;
  }
  // Questionário dentro do Vybe OS (Paulo, 09/11/2026: "todo questionário e tudo do onboard não devia já ser feito dentro
  // do Vybe OS?"): na reunião, preenche aqui mesmo, sem abrir outra aba. O link continua para o cliente responder sozinho.
  // Salva como o link (server/reunioes.js salvarOnboarding, "na reunião"): marca a esteira e vira regra o "O que nunca fazer".
  const nomeDoId = (id) => ((typeof CADASTRO_CLIENTES === 'undefined' ? [] : CADASTRO_CLIENTES).find((c) => String(c.id) === String(id)) || {}).nome || '';
  window.abrirQuestionario = async function abrirQuestionario(id, nome = '') {
    id = String(id || ''); nome = nome || nomeDoId(id);
    if (!id) return showToast('Escolha o cliente.', 'warning', 4000);
    if (!dados[id]?.d) await carregar(id);
    const e = dados[id];
    if (!e?.d) return showToast(e?.erro || 'Não consegui ler o questionário.', 'error', 6000);
    const { questoes = [], onboarding, acessos_pedidos: acessos = [] } = e.d;
    const resp = onboarding?.respostas || {};
    const bloco = (secao, titulo, sub = '') => `<fieldset class="onb-q-bloco"><legend>${titulo}</legend>${sub ? `<p class="onb-q-sub">${sub}</p>` : ''}
      <div class="cad-grade${secao === 'swot' ? ' onb-q-swot' : ''}">${questoes.filter((q) => q.secao === secao).map((q) => `<label class="cad-campo${secao === 'swot' ? '' : ' largo'}"><span>${esc(q.rotulo)}</span>
        <textarea data-onb-resp="${esc(q.chave)}" rows="${secao === 'swot' ? 4 : 3}">${esc(resp[q.chave] || '')}</textarea></label>`).join('')}</div></fieldset>`;
    openWorkflowModal(`<div class="cad-janela onb-q"><div class="workflow-kicker"><span>Vybe OS · Onboarding${nome ? ' · ' + esc(nome) : ''}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
      <h2 class="workflow-title">Questionário${nome ? ' de ' + esc(nome) : ''}</h2>
      <p class="workflow-copy">Preencha junto com o cliente. As respostas vão para a ficha, para a memória do VYBES, para o Augusto e para os chats do Claude; o "O que nunca fazer" vira regra do cliente. Empresa, responsável e canais ficam no ${nome ? `<button type="button" class="vc-link-inline" onclick="closeWorkflowModal();abrirCadastroCompleto('${asp(nome)}')">cadastro</button>` : 'cadastro'}.</p>
      <form class="cad-corpo" onsubmit="event.preventDefault()">
        ${bloco('negocio', 'Sobre o negócio')}${bloco('marca', 'A marca')}${bloco('swot', 'Análise SWOT', 'Forças e fraquezas são de dentro da empresa; oportunidades e ameaças vêm do mercado.')}
        ${acessos.length ? `<fieldset class="onb-q-bloco"><legend>Acessos</legend><p class="onb-q-sub">🔒 Vão direto para o cofre (Acessos), que só a administração abre, e não voltam para esta tela.</p>
          <div class="cad-grade">${acessos.map(([k, rot]) => `<label class="cad-campo largo"><span>${esc(rot)}</span><textarea data-onb-acesso="${esc(k)}" rows="2" autocomplete="off" placeholder="usuário / senha / observações"></textarea></label>`).join('')}</div></fieldset>` : ''}
      </form><p class="ciclo-erro" id="onb-q-erro" role="alert"></p>
      <div class="workflow-actions"><span class="cli-espaco"></span>
        <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Fechar</button>
        <button type="button" class="workflow-primary" onclick="salvarQuestionario('${esc(id)}', this)">Salvar respostas</button></div></div>`);
    document.getElementById('workflow-modal')?.classList.add('cad-modal');
    setTimeout(() => document.querySelector('.onb-q textarea')?.focus(), 40);
  };
  window.salvarQuestionario = async function salvarQuestionario(id, botao) {
    const respostas = {}, acessos = {};
    document.querySelectorAll('.onb-q [data-onb-resp]').forEach((t) => { respostas[t.dataset.onbResp] = t.value; });
    document.querySelectorAll('.onb-q [data-onb-acesso]').forEach((t) => { if (t.value.trim()) acessos[t.dataset.onbAcesso] = t.value; });
    if (botao) botao.disabled = true;
    try {
      const d = await postar({ acao: 'onboarding-salvar', cliente: id, respostas, acessos });
      document.querySelectorAll('.onb-q [data-onb-acesso]').forEach((t) => { t.value = ''; });
      const extra = [d.acessos_recebidos ? `${d.acessos_recebidos} acesso(s) no cofre` : '', d.marcados ? `${d.marcados} item(ns) marcado(s) na esteira` : '', d.regras_novas ? `${d.regras_novas} regra(s) nova(s) do cliente` : ''].filter(Boolean).join(' · ');
      showToast(`Respostas salvas.${extra ? ' ' + extra + '.' : ''}`, 'success', 6000);
      await carregar(id, true);
      if (window.VybeCarteira?.aberto?.()) window.VybeCarteira.abrir('onboarding', { abas: ['onboarding'] });
    } catch (e) { const er = document.getElementById('onb-q-erro'); if (er) er.textContent = e.message; else showToast(e.message, 'error', 6000); }
    finally { if (botao) botao.disabled = false; }
  };

  async function gerarLink(id) { const d = await postar({ acao: 'link-onboarding', cliente: id }); await carregar(id, true); return d.url; }
  window.onboardingJunto = async function onboardingJunto(id) {
    const janela = window.open('about:blank', '_blank');
    try { const url = await gerarLink(id); if (janela) janela.location = url + '?junto=1'; else location.href = url + '?junto=1'; }
    catch (e) { janela?.close(); showToast(e.message, 'error', 6000); }
  };
  window.onboardingLink = async function onboardingLink(id) {
    if (!await (typeof confirmarNoPainel === 'function' ? confirmarNoPainel('Gerar o link do onboarding para o cliente?\n\nSe já existir um link, o anterior deixa de valer.') : Promise.resolve(confirm('Gerar o link? O anterior deixa de valer.')))) return;
    try {
      const url = await gerarLink(id);
      try { await navigator.clipboard.writeText(url); showToast('Link copiado. Vale por 30 dias.', 'success', 6000); }
      catch { prompt('Copie o link do onboarding (vale por 30 dias):', url); }
    } catch (e) { showToast(e.message, 'error', 6000); }
  };

  // A ficha só mostra a aba Onboarding de quem está em onboarding ou já respondeu o questionário (Paulo, 09/11/2026:
  // "qual sentido de eu fazer onboard com quem já é cliente?"). O onboarding começa em Clientes → Onboarding.
  function temOnboarding(nome) {
    const id = String(idDoCliente(nome) || '');
    const d = id && dados[id]?.d;
    if (!d) return false;
    return Boolean(d.em_onboarding || Object.keys(d.onboarding?.respostas || {}).some((k) => !k.startsWith('_')));
  }
  // ── tela Reuniões (quadro "Reuniões" do moodboard, 12/11/2026) ─────────────────────────────────────────────
  // Lateral → Clientes → Reuniões abre uma janela, não mais só o formulário: a fala do Mateus, três números (esta
  // semana, sem ata, demandas sugeridas), "Pede ação" com a linha que abre no lugar, a lista com busca e filtros e,
  // ao lado, o formulário de Nova reunião (os mesmos campos e a mesma gravação de antes). As reuniões vêm da leitura
  // por cliente que a ficha já usava (area=reunioes&cliente=…), feita para cada cliente ativo.
  const tela = { raiz: null, janela: null, antes: null, form: true, filtro: 'todas', tipo: '', busca: '', inteira: false, lendo: false, quadro: 0 };
  const NA_FRENTE = 6;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  const corDe = (nome) => (typeof corDoClienteV2 === 'function' ? corDoClienteV2(nome) : '#6B665E');
  const iniciais = (n) => (String(n || '').trim().split(/\s+/)[0] || '?').slice(0, 2).toUpperCase();
  const pessoasDe = (texto) => String(texto || '').split(/[,;]/).map((p) => p.trim()).filter(Boolean);
  const avsHtml = (texto) => { const p = pessoasDe(texto);
    return p.length ? `<span class="v2r-avs" role="img" aria-label="Participantes: ${esc(p.join(', '))}">${p.slice(0, 3).map((x) => `<span class="v2r-av">${esc(iniciais(x))}</span>`).join('')}</span>` : ''; };
  const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 864e5);
  const diaMes = (iso) => `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}`;
  const cliHtml = (nome) => `<span class="v2r-cli" style="--c:${corDe(nome)}">${esc(nome)}</span>`;
  const XIS = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  function semanaDe(hoje) {
    const d = new Date(`${hoje}T12:00:00Z`), volta = (d.getUTCDay() + 6) % 7;
    const ini = new Date(d.getTime() - volta * 864e5), fim = new Date(ini.getTime() + 6 * 864e5);
    return [ini.toISOString().slice(0, 10), fim.toISOString().slice(0, 10)];
  }
  const todasAsReunioes = () => clientesAtivos().flatMap((c) => ((dados[c.id]?.d?.reunioes) || []).map((r) => ({ r, nome: c.nome, id: String(c.id), pode: Boolean(dados[c.id].d.pode) })));
  const pendentesDe = (r) => { const s = r.sugestoes; if (!s) return 0; const feitas = s.cadastradas || [];
    return (s.demandas || []).filter((d) => !feitas.some((f) => f.titulo === d.titulo)).length; };

  async function carregarTodas(forcar = false) {
    const ids = clientesAtivos().map((c) => String(c.id)).filter((id) => forcar || !dados[id]);
    if (!ids.length) return;
    tela.lendo = true;
    let i = 0;
    const fila = async () => { while (i < ids.length) { const id = ids[i]; i += 1; await carregar(id, forcar); } };
    await Promise.all(Array.from({ length: Math.min(6, ids.length) }, fila));
    tela.lendo = false;
    pintarTela();
  }

  function numerosDaTela() {
    const hoje = hojeIso(), [ini, fim] = semanaDe(hoje), lista = todasAsReunioes();
    const daSemana = lista.filter((x) => x.r.data >= ini && x.r.data <= fim);
    const proxima = lista.filter((x) => x.r.data >= hoje).sort((a, b) => a.r.data.localeCompare(b.r.data))[0];
    const semAta = lista.filter((x) => x.r.data <= hoje && !x.r.ata).sort((a, b) => a.r.data.localeCompare(b.r.data));
    const comSugestao = lista.filter((x) => pendentesDe(x.r) > 0).sort((a, b) => b.r.data.localeCompare(a.r.data));
    return { hoje, ini, fim, lista, daSemana, proxima, semAta, comSugestao, sugeridas: comSugestao.reduce((n, x) => n + pendentesDe(x.r), 0) };
  }
  const quandoTexto = (iso, hoje) => { const d = diasEntre(hoje, iso); return d === 0 ? 'hoje' : d === 1 ? 'amanhã' : d > 1 ? `em ${d} dias` : diaMes(iso); };

  // Direção 3 (moodboard 3, 13/11/2026): a fala do Mateus vira o bloco de ação laranja, numa frase curta com o botão.
  function falaDaTela(n) {
    const quem = '<small class="d3c-quem">Mateus · Atendimento</small>';
    const frase = tela.lendo && !n.lista.length ? 'Lendo as reuniões…'
      : !n.lista.length ? 'Nenhuma reunião registrada ainda.'
      : `${n.semAta.length ? `${plural(n.semAta.length, 'reunião feita', 'reuniões feitas')} sem ata.` : n.daSemana.length ? `${plural(n.daSemana.length, 'reunião', 'reuniões')} esta semana.` : 'Todas as feitas têm ata.'}${
        n.sugeridas ? ` ${n.sugeridas === 1 ? '1 demanda espera' : `${n.sugeridas} demandas esperam`} seu ok.` : ''}`;
    const botao = n.sugeridas ? (n.sugeridas === 1 ? 'Ver a demanda' : `Ver as ${n.sugeridas}`) : n.semAta.length ? (n.semAta.length === 1 ? 'Ver a reunião' : `Ver as ${n.semAta.length}`) : !n.lista.length && !tela.lendo ? 'Marcar a primeira' : '';
    const attrs = n.sugeridas ? 'data-v2r-acao="demandas"' : n.semAta.length ? 'data-v2r-acao="filtro" data-valor="sem-ata"' : 'data-v2r-acao="nova"';
    if (typeof d3AcaoHtml === 'function') return d3AcaoHtml({ frase: `${quem}${frase}`, agente: 'Mateus', botao, attrs });
    return `<span class="v2r-ag" aria-hidden="true">M</span><p class="v2r-fala-texto"><span class="v2r-quem">Mateus · Atendimento ao cliente</span>${frase}</p>${botao ? `<button type="button" class="v2r-btn s" ${attrs}>${esc(botao)}</button>` : ''}`;
  }
  // Direção 3: quatro números; "No mês" traz a linha das reuniões dos últimos meses.
  function kpisDaTela(n) {
    const kpi = (titulo, valor, sub, ruim, atraso, linha = '') => `<div class="v2r-card v2r-kpi d3-num${ruim ? ' r' : ''}"><small class="d3-num-rot">${titulo}</small><b class="d3-num-v"${atraso ? ` style="animation-delay:${atraso}"` : ''}>${valor}</b>${linha}<small class="d3c-sub">${sub}</small></div>`;
    const antiga = n.semAta[0];
    const mes = n.hoje.slice(0, 7), doMes = n.lista.filter((x) => String(x.r.data).startsWith(mes));
    const meses = []; for (let i = 5; i >= 0; i -= 1) { const d = new Date(`${mes}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - i); meses.push(d.toISOString().slice(0, 7)); }
    const serie = meses.map((m) => n.lista.filter((x) => String(x.r.data).startsWith(m)).length);
    const linha = typeof d3LinhaSvg === 'function' && serie.some(Boolean) ? d3LinhaSvg(serie, { largura: 90, altura: 28, rotulo: `Reuniões por mês: ${serie.join(', ')}` }) : '';
    return kpi('Esta semana', n.daSemana.length, n.proxima ? `próxima · ${quandoTexto(n.proxima.r.data, n.hoje)}` : 'nenhuma marcada')
      + kpi('Sem ata', n.semAta.length, antiga ? `a mais antiga · ${diasEntre(antiga.r.data, n.hoje) ? plural(diasEntre(antiga.r.data, n.hoje), 'dia', 'dias') : 'hoje'}` : 'todas com ata', n.semAta.length > 0, '.12s')
      + kpi('Demandas sugeridas', n.sugeridas, n.sugeridas ? 'esperando ok' : 'nenhuma esperando', false, '.24s')
      + kpi('No mês', doMes.length, `${doMes.filter((x) => x.r.ata).length} com ata`, false, '.36s', linha);
  }
  function pedeAcaoDaTela(n) {
    const tipoCurto = (r) => String(TIPOS_PADRAO[r.tipo] || 'reunião').split(/\s+/)[0].toLowerCase();
    const semAta = (x) => { const r = x.r, dias = diasEntre(r.data, n.hoje), resumo = Boolean(r.sugestoes?.resumo);
      const principal = !x.pode ? '' : resumo
        ? `<button type="button" class="v2r-btn s" data-v2r-acao="resumo" data-cli="${esc(x.id)}" data-reu="${esc(r.id)}" title="Abre a ata já preenchida com o resumo, para conferir e salvar">Usar o resumo</button>`
        : `<button type="button" class="v2r-btn s" data-v2r-acao="ata" data-cli="${esc(x.id)}" data-reu="${esc(r.id)}">Escrever a ata</button>`;
      return `<div class="v2-abre v2r-abre" aria-expanded="false"><div class="v2r-lin"><span class="v2r-pill r">Sem ata</span>
          <p><button type="button" class="v2r-abrir" data-v2r-acao="linha" aria-expanded="false">${cliHtml(x.nome)} · ${esc(tipoCurto(r))} de ${diaMes(r.data)}${r.gravacao ? (r.transcricao ? ', gravada e transcrita' : ', gravada') : ''}</button></p>
          ${avsHtml(r.participantes)}${principal}</div>
        <div class="v2-mais"><div><div class="v2r-dt">
          <p><b>Pauta</b> · ${r.pauta ? esc(String(r.pauta).split('\n')[0].replace(/^-\s*/, '').slice(0, 110)) : 'sem pauta escrita'}</p>
          <p><b>Ata</b> · em branco ${dias ? `há ${plural(dias, 'dia', 'dias')}` : 'desde hoje'}${resumo ? '; o resumo do VYBES está pronto' : r.gravacao ? '; o resumo ainda não chegou' : ''}</p>
          <p><b>Gravação</b> · ${r.gravacao ? `na pasta Reuniões do cliente no Drive${r.transcricao ? ', já transcrita' : ''}` : 'não foi gravada'}</p>
          ${r.gravacao || r.transcricao ? `<div class="v2r-botoes">${r.gravacao ? `<a class="v2r-btn s" href="https://drive.google.com/file/d/${esc(r.gravacao.id)}/view" target="_blank" rel="noopener">Ouvir a gravação</a>` : ''}${
            r.transcricao ? `<button type="button" class="v2r-btn s" data-v2r-acao="ficha" data-cli="${esc(x.id)}">Ler a transcrição</button>` : ''}</div>` : ''}
        </div></div></div></div>`; };
    const doVybes = (x) => { const q = pendentesDe(x.r);
      return `<div class="v2r-lin"><span class="v2r-pill v">Do VYBES</span><p>${cliHtml(x.nome)} · ${q === 1 ? '1 demanda sugerida' : `${q} demandas sugeridas`} na reunião de ${diaMes(x.r.data)}</p>
        <button type="button" class="v2r-btn s" data-v2r-acao="ficha" data-cli="${esc(x.id)}" data-v2r-conferir>Conferir</button></div>`; };
    const linhas = [...n.semAta.slice(0, 3).map(semAta), ...n.comSugestao.slice(0, 2).map(doVybes)];
    const total = n.semAta.length + n.comSugestao.length;
    const mais = n.semAta.length > 3 ? `<p class="v2r-pe">+ ${n.semAta.length - 3} sem ata · <button type="button" class="v2r-link" data-v2r-acao="filtro" data-valor="sem-ata">mostrar</button></p>` : '';
    return `<div class="v2r-card-topo"><h3>Pede ação</h3><span class="v2r-sub">${total ? `${total} · na ordem` : 'nada agora'}</span></div>
      ${linhas.join('') || `<p class="v2r-vazio">${tela.lendo ? 'Lendo as reuniões…' : 'Nenhuma reunião pede ação agora.'}</p>`}${mais}`;
  }
  function linhasDaTela(n) {
    if (!n.lista.length) return tela.lendo ? '<p class="v2r-vazio">Lendo as reuniões…</p>'
      : `<p class="v2r-vazio">Nenhuma reunião ainda.</p><p class="v2r-botoes"><button type="button" class="v2r-btn s" data-v2r-acao="nova">Marcar a primeira</button></p>`;
    const termo = tela.busca.trim().toLowerCase();
    const passa = (x) => (!termo || `${x.nome} ${x.r.titulo}`.toLowerCase().includes(termo)) && (!tela.tipo || x.r.tipo === tela.tipo)
      && (tela.filtro === 'semana' ? x.r.data >= n.ini && x.r.data <= n.fim : tela.filtro === 'sem-ata' ? x.r.data <= n.hoje && !x.r.ata : true);
    // Primeiro o que vem (a mais próxima no alto), depois o que já foi (a mais recente no alto).
    const filtradas = n.lista.filter(passa);
    const futuras = filtradas.filter((x) => x.r.data >= n.hoje).sort((a, b) => a.r.data.localeCompare(b.r.data));
    const passadas = filtradas.filter((x) => x.r.data < n.hoje).sort((a, b) => b.r.data.localeCompare(a.r.data));
    const ordem = [...futuras, ...passadas];
    if (!ordem.length) return '<p class="v2r-vazio">Nenhuma reunião com esse filtro.</p>';
    const corte = tela.inteira || termo ? ordem.length : Math.max(futuras.length, Math.min(NA_FRENTE, ordem.length));
    const linha = (x) => { const r = x.r, futura = r.data >= n.hoje;
      const pill = futura ? `<span class="v2r-pill b">${quandoTexto(r.data, n.hoje)}</span>` : r.ata ? '<span class="v2r-pill g">com ata</span>' : '<span class="v2r-pill r">sem ata</span>';
      return `<div class="v2r-lin"><span class="v2r-sub v2r-dia">${diaMes(r.data)}</span><p>${cliHtml(x.nome)} · ${esc(r.titulo)}</p>${avsHtml(r.participantes)}${pill}
        <button type="button" class="v2r-btn s" data-v2r-acao="${x.pode ? 'ata' : 'ficha'}" data-cli="${esc(x.id)}" data-reu="${esc(r.id)}" aria-label="Abrir a reunião ${esc(r.titulo)} de ${esc(x.nome)}">Abrir</button></div>`; };
    const resto = ordem.length - corte;
    return ordem.slice(0, corte).map(linha).join('')
      + (resto > 0 ? `<p class="v2r-pe">+ ${plural(resto, 'reunião anterior', 'reuniões anteriores')} · <button type="button" class="v2r-link" data-v2r-acao="mostrar">mostrar</button></p>` : '');
  }
  function formDaTela() {
    const opcoesTipo = Object.entries(TIPOS_PADRAO).map(([k, v]) => `<option value="${k}" ${k === 'rotina' ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return `<div class="v2r-card-topo"><h3>Nova reunião</h3><button type="button" class="v2r-btn s" data-v2r-acao="fechar-form" aria-label="Fechar Nova reunião">Fechar</button></div>
      <div class="v2r-g2"><div class="v2r-cp"><label for="reu-cliente">Cliente</label>
          <select class="v2r-inp" id="reu-cliente" onchange="trocarClienteDaReuniao(this.value)" required><option value="">Escolha o cliente</option>${clientesAtivos().map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></div>
        <div class="v2r-cp"><label for="reu-tipo">Tipo</label><select class="v2r-inp" id="reu-tipo">${opcoesTipo}</select></div></div>
      <div class="v2r-g2 v2r-g-data"><div class="v2r-cp"><label for="reu-data">Data</label><input class="v2r-inp" id="reu-data" type="date" value="${esc(hojeIso())}"></div>
        <div class="v2r-cp"><label for="reu-titulo">Título</label><input class="v2r-inp" id="reu-titulo" type="text" maxlength="160" placeholder="Ex.: Entrada da Lil"></div></div>
      <div class="v2r-cp"><label for="reu-participantes">Participantes</label>
        <div class="v2r-inp v2r-pt"><span class="v2r-avs" data-v2r-avs aria-hidden="true"></span><input class="v2r-nu" id="reu-participantes" type="text" maxlength="600" placeholder="Quem estava" autocomplete="off"></div></div>
      <div class="v2r-cp"><label for="reu-pauta">Pauta <span class="d3r-sugerida" title="Sugerida com o que o sistema sabe do cliente. Edite à vontade.">sugerida</span></label><textarea class="v2r-inp" id="reu-pauta" rows="3"></textarea></div>
      <div class="v2r-cp v2r-cp-ata"><label for="reu-ata">Ata</label><textarea class="v2r-inp" id="reu-ata" rows="3" placeholder="O que foi falado, o que ficou decidido, próximos passos e responsáveis"></textarea></div>
      <p class="ciclo-erro" id="reu-erro" role="alert"></p>
      <div class="v2r-form-pe"><button type="button" class="v2r-btn" data-v2r-acao="fechar-form">Cancelar</button>
        <button type="button" class="v2r-btn d3r-gravar" ${gravando ? 'disabled' : ''} title="O áudio vai para a pasta Reuniões do cliente no Drive; o VYBES devolve a transcrição, o resumo e as demandas sugeridas na ficha." onclick="salvarReuniao('', '', true)">Salvar e gravar</button>
        <button type="button" class="v2r-btn k" onclick="salvarReuniao('', '')">Salvar</button></div>`;
  }
  function pintarForm() {
    const alvo = tela.janela?.querySelector('[data-v2r="form"]');
    if (!alvo) return;
    alvo.hidden = !tela.form;
    alvo.innerHTML = tela.form ? formDaTela() : '';
    tela.janela.querySelector('.v2r-dupla')?.classList.toggle('so-lista', !tela.form);
  }
  function pintarTela() {
    if (!tela.janela) return;
    cancelAnimationFrame(tela.quadro);
    tela.quadro = requestAnimationFrame(() => {
      const j = tela.janela; if (!j) return;
      const n = numerosDaTela();
      const abertas = new Set([...j.querySelectorAll('[data-v2r="pede"] .v2-abre[aria-expanded="true"] [data-reu]')].map((b) => b.dataset.reu));
      j.querySelector('[data-v2r="fala"]').innerHTML = falaDaTela(n);
      const kpis = j.querySelector('[data-v2r="kpis"]'), antes = kpis.dataset.v, agora = `${n.daSemana.length}|${n.semAta.length}|${n.sugeridas}|${n.proxima?.r.data || ''}|${n.lista.length}`;
      if (antes !== agora) { kpis.dataset.v = agora; kpis.innerHTML = kpisDaTela(n); }
      j.querySelector('[data-v2r="pede"]').innerHTML = pedeAcaoDaTela(n);
      j.querySelectorAll('[data-v2r="pede"] .v2-abre').forEach((b) => { if (abertas.has(b.querySelector('[data-reu]')?.dataset.reu)) { b.setAttribute('aria-expanded', 'true'); b.querySelector('.v2r-abrir')?.setAttribute('aria-expanded', 'true'); } });
      j.querySelector('[data-v2r="linhas"]').innerHTML = linhasDaTela(n);
      j.querySelector('.v2r-filtros').hidden = !n.lista.length;
      j.querySelectorAll('.v2r-filtros [data-valor]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.valor === tela.filtro)));
      const bf = j.querySelector('[data-v2r-acao="tipos"]');
      if (bf) { bf.textContent = tela.tipo ? `Filtros: ${String(TIPOS_PADRAO[tela.tipo] || tela.tipo).split(/\s+/)[0]}` : 'Filtros'; bf.setAttribute('aria-pressed', String(Boolean(tela.tipo))); }
    });
  }
  function abrirFormDaTela() {
    if (!tela.form) { tela.form = true; pintarForm(); }
    const campo = tela.janela?.querySelector('#reu-cliente');
    campo?.scrollIntoView?.({ block: 'nearest' });
    campo?.focus();
  }
  function irParaFicha(id, aba = 'reunioes') {
    const nome = nomeDoId(id);
    if (!nome || typeof abrirFichaNoModulo !== 'function') return;
    fecharTela({ foco: false });
    abrirFichaNoModulo(nome, aba);
  }
  function aoClicarNaTela(e) {
    const b = e.target.closest('[data-v2r-acao]');
    if (!b || !tela.raiz?.contains(b)) return;
    const acao = b.dataset.v2rAcao, d = b.dataset;
    if (acao === 'fechar') return fecharTela();
    if (acao === 'nova') return abrirFormDaTela();
    if (acao === 'fechar-form') { tela.form = false; pintarForm(); tela.janela.querySelector('[data-v2r-acao="nova"]')?.focus(); return; }
    if (acao === 'filtro') { tela.filtro = d.valor; tela.inteira = false; return pintarTela(); }
    if (acao === 'mostrar') { tela.inteira = true; return pintarTela(); }
    if (acao === 'linha') { const bloco = b.closest('.v2-abre'), abre = bloco.getAttribute('aria-expanded') !== 'true';
      bloco.setAttribute('aria-expanded', String(abre)); b.setAttribute('aria-expanded', String(abre)); return; }
    if (acao === 'ficha') return irParaFicha(d.cli);
    if (acao === 'demandas') { const alvos = [...tela.janela.querySelectorAll('[data-v2r-conferir]')];
      if (alvos.length === 1) return irParaFicha(alvos[0].dataset.cli);
      alvos[0]?.scrollIntoView?.({ block: 'center' }); alvos[0]?.focus(); return; }
    if (acao === 'ata' || acao === 'resumo') { const nome = nomeDoId(d.cli);
      const r = (dados[d.cli]?.d?.reunioes || []).find((x) => x.id === String(d.reu));
      const s = r?.sugestoes;
      const texto = acao === 'resumo' && s ? [s.resumo, (s.decisoes || []).length ? `Decisões:\n${s.decisoes.map((x) => `- ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n') : '';
      return window.abrirReuniao(nome, d.reu, texto ? { ata: texto } : {}); }
    if (acao === 'tipos' && typeof abrirListaDoPainel === 'function') return abrirListaDoPainel(b, { titulo: 'Filtrar por tipo', atual: tela.tipo,
      opcoes: [{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS_PADRAO).map(([valor, rotulo]) => ({ valor, rotulo }))],
      aoEscolher: (valor) => { tela.tipo = valor; tela.inteira = false; pintarTela(); } });
  }
  function aoDigitarNaTela(e) {
    if (e.target.matches?.('[data-v2r-busca]')) { tela.busca = e.target.value; pintarTela(); }
    if (e.target.id === 'reu-participantes') { const alvo = tela.janela?.querySelector('[data-v2r-avs]');
      if (alvo) alvo.innerHTML = pessoasDe(e.target.value).slice(0, 4).map((p) => `<span class="v2r-av v2-pop">${esc(iniciais(p))}</span>`).join(''); }
  }
  function aoTeclarNaTela(e) {
    if (!tela.raiz || e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('#workflow-modal, #cli-lista, .vv-tour')) return;
    e.preventDefault(); e.stopPropagation();
    fecharTela();
  }
  // Outro item do menu lateral fecha esta janela (as outras janelas de módulo fazem o mesmo pelo vybe-mundo.js).
  function aoClicarFora(e) {
    if (!tela.raiz) return;
    const item = e.target.closest?.('.vv-trilho [data-trilho], .vv-trilho [data-submodulo]');
    if (item && item.dataset.submodulo !== 'reunioes' && !String(item.dataset.trilho || '').startsWith('setor:')) fecharTela({ foco: false });
  }
  function abrirTela() {
    if (!tela.raiz) {
      tela.antes = document.activeElement || null;
      tela.form = !window.matchMedia?.('(max-width: 720px)').matches;
      Object.assign(tela, { filtro: 'todas', tipo: '', busca: '', inteira: false });
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vc-camada v2r-camada';
      janela.id = 'vv-reunioes';
      janela.className = 'vc-janela';
      janela.setAttribute('role', 'dialog');
      janela.setAttribute('aria-modal', 'true');
      janela.setAttribute('aria-labelledby', 'v2r-titulo');
      // Direção 3: a data no título, "Nova reunião" em botão branco, Pede ação e a lista em cartões separados.
      const diaHoje = new Date(`${hojeIso()}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).replace(/-feira/, '').replace(/\.$/, '').replace(' de ', ' ');
      janela.innerHTML = `<div class="v2r d3r">
        <div class="v2r-topo"><h2 id="v2r-titulo">Reuniões</h2><span class="d3c-meta">${esc(diaHoje)}</span><button type="button" class="v2r-btn p" data-v2r-acao="nova">Nova reunião</button>
          <button type="button" class="v2r-x" data-v2r-acao="fechar" aria-label="Fechar" title="Fechar (Esc)">${XIS}</button></div>
        <div class="v2r-corpo">
          <div class="v2r-fala-d3" data-v2r="fala" aria-label="Leitura do Mateus"></div>
          <div class="v2r-kpis" data-v2r="kpis"></div>
          <div class="v2r-dupla">
            <div class="v2r-col"><section class="v2r-card v2r-pede" aria-label="Pede ação"><div data-v2r="pede"></div></section>
            <section class="v2r-card v2r-lista" aria-label="Reuniões">
              <div class="v2r-filtros" hidden><label for="v2r-busca" class="v2r-oculto">Buscar reunião por cliente ou título</label>
                <input id="v2r-busca" class="v2r-busca" type="search" data-v2r-busca placeholder="Buscar reunião" autocomplete="off">
                <button type="button" class="v2r-chip" data-v2r-acao="filtro" data-valor="todas" aria-pressed="true">Todas</button><button type="button" class="v2r-chip" data-v2r-acao="filtro" data-valor="semana" aria-pressed="false">Esta semana</button><button type="button" class="v2r-chip" data-v2r-acao="filtro" data-valor="sem-ata" aria-pressed="false">Sem ata</button>
                <button type="button" class="v2r-btn s" data-v2r-acao="tipos" aria-haspopup="listbox" aria-pressed="false">Filtros</button></div>
              <div data-v2r="linhas"></div></section></div>
            <section class="v2r-card v2r-form" data-v2r="form" aria-label="Nova reunião"></section>
          </div>
        </div></div>`;
      raiz.append(janela);
      raiz.addEventListener('click', aoClicarNaTela);
      raiz.addEventListener('input', aoDigitarNaTela);
      document.body.append(raiz);
      Object.assign(tela, { raiz, janela });
      pintarForm();
    }
    pintarTela();
    const pronto = async () => {
      if (!clientesAtivos().length && typeof ensureClientMasterSources === 'function') { tela.lendo = true; await ensureClientMasterSources(true).catch(() => null); tela.lendo = false; if (tela.janela) pintarForm(); }
      await carregarTodas();
      pintarTela();
    };
    return pronto();
  }
  function fecharTela(opcoes = {}) {
    const { raiz, antes } = tela;
    if (!raiz) return;
    cancelAnimationFrame(tela.quadro);
    Object.assign(tela, { raiz: null, janela: null, antes: null });
    raiz.remove();
    if (opcoes.foco !== false && antes?.isConnected) antes.focus?.();
  }
  window.addEventListener('keydown', aoTeclarNaTela, true);
  document.addEventListener('click', aoClicarFora, true);

  // Lateral → Clientes → Reuniões (vybe-mundo.js chama abrir(parte, opções), como nos outros módulos).
  const abrir = () => abrirTela();
  window.VybeReunioes = { reunioesHtml, onboardingHtml, carregar, temOnboarding, abrir, fechar: fecharTela, aberto: () => Boolean(tela.raiz), dadosDe };
})();
