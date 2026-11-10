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
    if (dados[id] && !forcar && (dados[id].d || dados[id].carregando)) return;
    dados[id] = { carregando: true };
    try {
      const r = await fetch(`/api/painel?area=reunioes&cliente=${encodeURIComponent(id)}`, { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Não consegui ler as reuniões.');
      dados[id] = { d };
    } catch (e) { dados[id] = { erro: e.message }; }
    repintar();
  }
  const repintar = () => { if (typeof CLIENTE_ABERTO === 'string' && CLIENTE_ABERTO && typeof renderClientMasterDetail === 'function') renderClientMasterDetail(CLIENTE_ABERTO); };
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

  window.abrirReuniao = function abrirReuniao(nome, reuniaoId = '') {
    const id = String(idDoCliente(nome) || '');
    const e = dados[id]?.d || {};
    const r = (e.reunioes || []).find((x) => x.id === String(reuniaoId)) || null;
    const tipos = e.tipos || { rotina: 'Rotina com o cliente', onboarding: 'Onboarding / kickoff', alinhamento: 'Alinhamento', comercial: 'Comercial', interna: 'Interna' };
    const pautaPadrao = r ? r.pauta : (e.pauta || []).map((p) => '- ' + p).join('\n');
    openWorkflowModal(`<div class="cad-janela"><div class="workflow-kicker"><span>Vybe OS · Reunião · ${esc(nome)}</span>
      <button class="workflow-close" type="button" aria-label="Fechar" onclick="closeWorkflowModal()">×</button></div>
      <h2 class="workflow-title">${r ? 'Ata da reunião' : 'Nova reunião'}</h2>
      <div class="cad-grade">
        <label class="cad-campo"><span>Tipo</span><select id="reu-tipo">${Object.entries(tipos).map(([k, v]) => `<option value="${k}" ${(r?.tipo || 'rotina') === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <label class="cad-campo"><span>Data</span><input id="reu-data" type="date" value="${esc(r?.data || hojeIso())}"></label>
        <label class="cad-campo largo"><span>Título</span><input id="reu-titulo" maxlength="160" value="${esc(r?.titulo || '')}" placeholder="Ex.: Entrada da Lil"></label>
        <label class="cad-campo largo"><span>Participantes</span><input id="reu-participantes" maxlength="600" value="${esc(r?.participantes || '')}" placeholder="Quem estava"></label>
        <label class="cad-campo largo"><span>Pauta</span><textarea id="reu-pauta" rows="5">${esc(pautaPadrao || '')}</textarea><small>Sugerida com o que o sistema sabe do cliente. Edite à vontade.</small></label>
        <label class="cad-campo largo"><span>Ata</span><textarea id="reu-ata" rows="10" placeholder="O que foi falado, o que ficou decidido, próximos passos e responsáveis">${esc(r?.ata || '')}</textarea></label>
      </div><p class="ciclo-erro" id="reu-erro" role="alert"></p>
      <div class="workflow-actions"><span class="cli-espaco"></span>
        <button type="button" class="workflow-secondary" onclick="closeWorkflowModal()">Cancelar</button>
        ${!r?.gravacao ? `<button type="button" class="workflow-secondary" ${gravando ? 'disabled' : ''} onclick="salvarReuniao('${asp(nome)}','${esc(r?.id || '')}',true)">Salvar e gravar</button>` : ''}
        <button type="button" class="workflow-primary" onclick="salvarReuniao('${asp(nome)}','${esc(r?.id || '')}')">Salvar</button></div></div>`);
    document.getElementById('workflow-modal')?.classList.add('cad-modal');
  };

  window.salvarReuniao = async function salvarReuniao(nome, reuniaoId, gravarDepois = false) {
    const id = String(idDoCliente(nome) || '');
    const v = (k) => document.getElementById('reu-' + k)?.value || '';
    try {
      const d = await postar({ acao: 'salvar', cliente: id, id: reuniaoId || undefined, tipo: v('tipo'), data: v('data'), titulo: v('titulo'), participantes: v('participantes'), pauta: v('pauta'), ata: v('ata') });
      closeWorkflowModal();
      showToast('Reunião salva.', 'success', 3500);
      await carregar(id, true);
      if (gravarDepois) gravarReuniao(id, d.reuniao.id, d.reuniao.titulo);
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
        ${pode ? `<span class="onb-botoes"><button type="button" class="vb-botao principal" onclick="onboardingJunto('${esc(id)}')">Preencher com o cliente agora</button>
          <button type="button" class="vb-botao" onclick="onboardingLink('${esc(id)}')">Link para o cliente</button></span>` : ''}</div>
      <p>${preenchidas} de ${questoes.length} perguntas respondidas${resp._atualizado_em ? ` · última vez em ${dataBr(resp._atualizado_em)}${resp._por === 'reuniao' ? ', na reunião' : ', pelo cliente'}` : ''}. O cadastro (empresa, responsável, canais) vai para a aba Cadastro; os acessos, para o cofre de Acessos.</p>
      ${SECOES.map(([s, t]) => `<section class="cad-leitura"><h4>${t}</h4><dl>${bloco(s)}</dl></section>`).join('')}
      <section class="cad-leitura"><h4>Análise SWOT</h4><div class="onb-swot">${swot}</div></section>
      <p class="onb-dica">O checklist do onboarding (boas-vindas, contrato, acessos, kickoff, primeiro mês) continua em Clientes → Onboarding. A reunião de kickoff fica na aba Reuniões.</p></div>`;
  }
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

  window.VybeReunioes = { reunioesHtml, onboardingHtml, carregar };
})();
