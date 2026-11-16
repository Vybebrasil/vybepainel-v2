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
  // Prancha V2-M-Cliente-Reunioes (16/11/2026): no esqueleto das abas da ficha (peças fv2-* de vybe-clientes-ficha.js).
  // À esquerda, três folhas: a reunião em foco (pauta e ata lado a lado; no pé, a gravação e os botões), a pauta
  // sugerida para a próxima e as outras reuniões (o clique traz a reunião para a folha do alto). No vidro: o cartão
  // laranja com o que pede ação (gravando, demandas sugeridas, ata faltando, sem a próxima), os tipos e o que sai dali.
  const focoNaFicha = {}; // clienteId → id da reunião na folha do alto
  window.verReuniaoNaFicha = function verReuniaoNaFicha(clienteId, reuniaoId) { focoNaFicha[String(clienteId)] = String(reuniaoId); repintar(String(clienteId)); };
  window.copiarPautaSugerida = async function copiarPautaSugerida(clienteId) {
    const texto = pautaDe(String(clienteId));
    if (!texto) return;
    try { await navigator.clipboard.writeText(texto); showToast('Pauta copiada.', 'success', 3000); }
    catch { showToast('Não consegui copiar. Abra Nova reunião: a pauta já vem preenchida.', 'info', 5000); }
  };
  const soUmaFolha = (aba, ico, titulo, texto = '', botao = '') => fv2DuasHtml(aba, `<section class="fv2-folha fv2-cheia">${fv2VazioHtml(ico, titulo, texto, botao)}</section>`, '');
  function reunioesHtml(nome) {
    const id = String(idDoCliente(nome) || '');
    if (!id) return soUmaFolha('reunioes', 'falta', 'Este cliente ainda não tem ficha própria', 'Crie a ficha para registrar reuniões.');
    const e = dados[id];
    if (!e) { carregar(id); return soUmaFolha('reunioes', 'relogio', 'Lendo as reuniões…'); }
    if (e.carregando) return soUmaFolha('reunioes', 'relogio', 'Lendo as reuniões…');
    if (e.erro) return soUmaFolha('reunioes', 'falta', esc(e.erro));
    const { reunioes = [], pauta = [], pode, tipos = {} } = e.d;
    const hoje = hojeIso(), n = asp(nome), vai = typeof CV2_IC !== 'undefined' ? CV2_IC.vai : '';
    const ordem = [...reunioes].sort((a, b) => String(b.data).localeCompare(String(a.data)));
    const passadas = ordem.filter((r) => r.data <= hoje), futuras = ordem.filter((r) => r.data > hoje).reverse();
    const atual = ordem.find((r) => r.id === focoNaFicha[id]) || passadas[0] || ordem[0] || null;
    const outras = ordem.filter((r) => r !== atual);
    const grav = gravando && gravando.clienteId === id;
    const tipoDe = (r) => String(tipos[r.tipo] || TIPOS_PADRAO[r.tipo] || r.tipo || 'reunião').toLowerCase();
    const extenso = (iso) => (typeof dataPorExtensoV2 === 'function' ? dataPorExtensoV2(iso) : dataBr(iso));
    const pes = (texto) => pessoasDe(texto).slice(0, 4).map((p) => `<i class="cv2-pes" title="${esc(p)}" aria-hidden="true">${esc(iniciais(p))}</i>`).join('');
    const linhasDe = (texto) => String(texto || '').split('\n').map((l) => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean);
    const acao = (rot, attrs) => `<button type="button" class="d3v-btn sec s fv2-op-acao" ${attrs}>${rot}</button>`;

    // A reunião em foco.
    const folhaAtual = !atual ? '' : (() => { const r = atual, pend = pendentesDe(r), itens = linhasDe(r.pauta);
      const estado = grav && gravando.reuniaoId === String(r.id) ? '<b>Gravando agora</b> · a barra de gravação fica no pé da tela'
        : r.gravacao ? `<b>Gravada</b> · o áudio está no Drive${r.transcricao ? ', com a transcrição' : r.estado === 'transcricao_falhou' ? '; a transcrição falhou' : '; a transcrição chega quando o bot processar'}`
        : '<b>Sem gravação</b> · só a pauta e a ata escritas';
      const doBot = sugestoesHtml(r, pode) + (r.transcricao ? `<h5>Transcrição</h5><p class="reu-transcricao">${esc(r.transcricao.slice(0, 4000)).replace(/\n/g, '<br>')}</p>` : '');
      return `<section class="fv2-folha fv2-reu" aria-label="Reunião de ${esc(extenso(r.data))}"><div class="cv2-cab"><h3>${esc(r.titulo || 'Reunião')} <span>· ${esc(tipoDe(r))}</span></h3><span class="fv2-cab-lado">${esc(extenso(r.data))}${pes(r.participantes)}</span></div>
        <div class="fv2-reu-corpo"><div class="fv2-reu-2"><div class="fv2-reu-parte"><span class="d3v-rot">pauta</span>${itens.length ? `<ul>${itens.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '<p class="fv2-reu-sem">Sem pauta escrita.</p>'}</div>
          <div class="fv2-reu-parte"><span class="d3v-rot">ata</span>${r.ata ? `<p>${esc(r.ata).replace(/\n/g, '<br>')}</p>` : '<p class="fv2-reu-sem">Ainda sem ata.</p>'}</div></div>
          ${doBot ? `<details class="fv2-reu-mais"${pend ? ' open' : ''}><summary>O que o VYBES tirou da reunião${pend ? ` · ${plural(pend, 'demanda sugerida', 'demandas sugeridas')}` : ''}</summary><div class="fv2-reu-mais-c">${doBot}</div></details>` : ''}</div>
        <div class="fv2-reu-pe"><i class="fv2-reu-mic${r.gravacao ? ' on' : ''}" aria-hidden="true">${FV2_ICO.mic}</i><span class="fv2-reu-estado">${estado}</span><span class="fv2-reu-bts">${
          r.gravacao ? `<a class="d3v-btn sec s fv2-op-acao" href="https://drive.google.com/file/d/${esc(r.gravacao.id)}/view" target="_blank" rel="noopener">Ouvir a gravação</a>`
            : pode ? acao('Gravar', `${gravando ? 'disabled ' : ''}onclick="gravarReuniao('${esc(id)}','${esc(r.id)}','${asp(r.titulo)}')"`) : ''}${
          pode ? acao('Editar a ata', `onclick="abrirReuniao('${n}','${esc(r.id)}')"`) : ''}</span></div></section>`; })();

    // A pauta sugerida para a próxima.
    const folhaPauta = pauta.length ? `<section class="fv2-folha fv2-fixa" aria-label="Pauta sugerida para a próxima"><div class="cv2-cab"><h3>Pauta sugerida para a próxima</h3><span class="fv2-cab-nota">o VYBES monta com o que ficou aberto</span></div>
        <ol class="fv2-tb fv2-reu-pauta">${pauta.map((p, i) => `<li class="fv2-tb-lin"><i class="fv2-n" aria-hidden="true">${i + 1}</i><span class="fv2-tb-txt">${esc(p)}</span></li>`).join('')}</ol></section>` : '';

    // As outras reuniões.
    const estadoDe = (r) => (r.data > hoje ? ['b', 'marcada'] : r.ata ? ['g', 'com ata'] : ['r', 'sem ata']);
    const linhaReu = (r) => { const [tom, rot] = estadoDe(r);
      return `<button type="button" class="fv2-tb-lin fv2-reu-lin" title="Ver a pauta e a ata" onclick="verReuniaoNaFicha('${esc(id)}','${esc(r.id)}')"><span class="fv2-reu-dia">${dataBr(r.data)}</span><span class="fv2-tb-txt"><b>${esc(r.titulo || 'Reunião')}</b> · ${esc(tipoDe(r))}</span>${pes(r.participantes)}<span class="fv2-est ${tom}"><i aria-hidden="true"></i>${rot}${r.gravacao ? ', gravada' : ''}</span>${vai}</button>`; };
    const mesDe = (iso) => (typeof MESES_V2 !== 'undefined' && /^\d{4}-\d{2}/.test(String(iso)) ? MESES_V2[Number(String(iso).slice(5, 7)) - 1] : '');
    const folhaOutras = `<section class="fv2-folha fv2-cheia" aria-label="Outras reuniões"><div class="cv2-cab"><h3>${futuras.some((r) => r !== atual) ? 'Outras reuniões' : 'Reuniões anteriores'}</h3><span class="fv2-cab-nota">${reunioes.length ? plural(reunioes.length, 'registrada', 'registradas') : ''}</span>${
        pode ? `<button type="button" class="fv2-cab-acao" onclick="abrirReuniao('${n}')">nova reunião</button>` : ''}</div>
      ${outras.length ? `<div class="fv2-tb fv2-linhas">${outras.map(linhaReu).join('')}</div>`
        : fv2VazioHtml('relogio', atual ? `Só a de ${esc(mesDe(atual.data) || dataBr(atual.data))}, por enquanto` : 'Nenhuma reunião registrada ainda', 'Cada reunião fica aqui, com a pauta, a ata e a gravação.')}</section>`;

    // O cartão laranja: o que pede ação nas reuniões deste cliente.
    const f = typeof cadastroDoCliente === 'function' ? cadastroDoCliente(nome) || {} : {};
    const proxima = [String(f.proxima_reuniao || '').slice(0, 10), futuras[0]?.data].filter((d) => d && d >= hoje).sort()[0] || '';
    const semAta = passadas.filter((r) => !r.ata);
    const comPend = ordem.filter((r) => pendentesDe(r) > 0), sugeridas = comPend.reduce((t, r) => t + pendentesDe(r), 0);
    const btNova = (rot) => (pode ? `<button type="button" class="d3m-btn l" onclick="abrirReuniao('${n}')">${rot}</button>` : '');
    const btPauta = pauta.length ? `<button type="button" class="d3m-btn l s" onclick="copiarPautaSugerida('${esc(id)}')">Copiar a pauta</button>` : '';
    const alto = grav ? fv2LaranjaHtml({ rotulo: 'gravando agora', titulo: 'A reunião está sendo gravada', apoio: 'Quando parar, o áudio sobe para a pasta Reuniões do cliente no Drive.',
        botoes: '<button type="button" class="d3m-btn l" onclick="pararGravacao()">Parar e salvar</button>' })
      : sugeridas ? fv2LaranjaHtml({ rotulo: 'saiu da reunião', n: sugeridas, titulo: sugeridas === 1 ? 'demanda sugerida espera seu ok' : 'demandas sugeridas esperam seu ok', apoio: `O VYBES tirou da reunião de ${diaMes(comPend[0].data)}.`,
        botoes: `<button type="button" class="d3m-btn l" onclick="verReuniaoNaFicha('${esc(id)}','${esc(comPend[0].id)}')">Conferir</button>` })
      : semAta.length ? fv2LaranjaHtml({ rotulo: 'falta a ata', n: semAta.length, titulo: semAta.length === 1 ? 'reunião feita sem ata' : 'reuniões feitas sem ata', apoio: `A mais antiga é de ${diaMes(semAta[semAta.length - 1].data)}.`,
        botoes: pode ? `<button type="button" class="d3m-btn l" onclick="abrirReuniao('${n}','${esc(semAta[semAta.length - 1].id)}')">Escrever a ata</button>` : '' })
      : !ordem.length ? fv2LaranjaHtml({ rotulo: 'sem reunião', titulo: 'Nenhuma reunião registrada ainda', apoio: 'A primeira guarda a pauta, a ata e a gravação.', botoes: btNova('Nova reunião') + btPauta })
      : !proxima ? fv2LaranjaHtml({ rotulo: 'sem a próxima', titulo: 'A próxima reunião ainda não tem data', apoio: `${passadas[0] ? `A última foi em ${diaMes(passadas[0].data)}. ` : ''}${pauta.length ? 'A pauta sugerida já está pronta.' : ''}`, botoes: btNova('Marcar reunião') + btPauta })
      : fv2CalmoHtml(`Próxima reunião em ${diaMes(proxima)}.`, pauta.length ? 'A pauta sugerida já está pronta.' : 'Todas as reuniões feitas têm ata.');
    const nomesTipos = Object.values(Object.keys(tipos).length ? tipos : TIPOS_PADRAO).map((t, i) => (i ? String(t).toLowerCase() : String(t)));
    const drive = typeof clientMasterLinkedData === 'function' && typeof linkDeCliente === 'function' ? linkDeCliente(clientMasterLinkedData(nome).drive) : '';
    const gravadas = ordem.filter((r) => r.gravacao).length;
    const lado = alto + fv2ConsHtml('Tipos de reunião', '', `<p class="fv2-nota-lado">${esc(nomesTipos.join(', ').replace(/, ([^,]*)$/, ' e $1'))}.</p>`)
      + fv2ConsHtml('O que sai de uma reunião', '', (sugeridas ? fv2VlinHtml('Demandas sugeridas', `${sugeridas} esperando`, `verReuniaoNaFicha('${esc(id)}','${esc(comPend[0].id)}')`)
          : '<div class="d3m-vlin"><span><b>Demandas sugeridas</b> · nenhuma esperando</span></div>')
        + (drive ? `<a class="d3m-vlin" href="${esc(drive)}" target="_blank" rel="noopener"><span><b>Gravações no Drive</b>${gravadas ? ` · ${plural(gravadas, 'gravada', 'gravadas')}` : ''}</span>${vai}</a>`
          : `<div class="d3m-vlin"><span><b>Gravações</b> · ${gravadas ? plural(gravadas, 'gravada', 'gravadas') : 'nenhuma ainda'}</span></div>`));
    return fv2DuasHtml('reunioes', folhaAtual + folhaPauta + folhaOutras, lado);
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
        ${pode ? `<button type="button" class="d3v-btn s" onclick="cadastrarDemandasReuniao('${esc(r.cliente_id)}','${esc(r.id)}', this)">Cadastrar as marcadas em Solicitações</button>` : ''}` : '<p class="cli-vazio">Nenhuma demanda sugerida.</p>'}
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
  // Prancha V2-M-Cliente-Onboarding (16/11/2026): o questionário de entrada numa folha (as partes, a marca de respondida,
  // a pergunta e a resposta); no vidro, o cartão laranja com quantas faltam, para onde vai cada coisa, a conta por parte
  // e os atalhos. "Preencher agora" e "Mandar o link" são os mesmos de antes (abrirQuestionario e onboardingLink).
  const SECOES_DA_ABA = [...SECOES, ['swot', 'Análise SWOT']];
  const soFaltamNaFicha = {}; // clienteId → a folha mostra só as perguntas sem resposta
  window.alternarFaltasDoQuestionario = function alternarFaltasDoQuestionario(clienteId) { soFaltamNaFicha[String(clienteId)] = !soFaltamNaFicha[String(clienteId)]; repintar(String(clienteId)); };
  function onboardingHtml(nome) {
    const id = String(idDoCliente(nome) || '');
    if (!id) return soUmaFolha('onboarding', 'falta', 'Este cliente ainda não tem ficha própria', 'Crie a ficha do cliente para fazer o onboarding.');
    const e = dados[id];
    if (!e || e.carregando) { if (!e) carregar(id); return soUmaFolha('onboarding', 'relogio', 'Lendo o onboarding…'); }
    if (e.erro) return soUmaFolha('onboarding', 'falta', esc(e.erro));
    const { questoes = [], onboarding, pode } = e.d;
    const resp = onboarding?.respostas || {}, n = asp(nome);
    const feitas = questoes.filter((q) => resp[q.chave]).length, faltam = questoes.length - feitas;
    const soFaltam = Boolean(soFaltamNaFicha[id]) && faltam > 0 && feitas > 0;
    const quando = resp._atualizado_em ? `${diaMes(String(resp._atualizado_em).slice(0, 10))}${resp._por === 'reuniao' ? ', na reunião' : ', pelo cliente'}` : '';
    const partes = SECOES_DA_ABA.map(([s, titulo]) => { const todas = questoes.filter((q) => q.secao === s);
      return { s, titulo, todas, ok: todas.filter((q) => resp[q.chave]).length }; }).filter((p) => p.todas.length);
    const linha = (q) => { const v = resp[q.chave];
      return `<div class="fv2-tb-lin fv2-onb-lin${v ? ' ok' : ' falta'}"><i class="fv2-onb-marca" aria-hidden="true">${v ? FV2_ICO.ok : ''}</i><span class="fv2-onb-q">${esc(q.rotulo)}</span><span class="fv2-onb-r">${v ? esc(v).replace(/\n/g, '<br>') : 'sem resposta'}</span></div>`; };
    const corpo = partes.map((p) => { const mostra = soFaltam ? p.todas.filter((q) => !resp[q.chave]) : p.todas;
      return mostra.length ? `<div class="fv2-onb-sec"><b>${p.titulo}</b><span>${p.ok} de ${p.todas.length}</span></div>${mostra.map(linha).join('')}` : ''; }).join('');
    const folha = `<section class="fv2-folha fv2-cheia fv2-onb" aria-label="Questionário de entrada"><div class="cv2-cab"><h3>Questionário de entrada <span>· ${feitas} de ${questoes.length} respondidas</span></h3>${
        quando ? `<span class="fv2-cab-nota">última vez em ${quando}</span>` : ''}${faltam && feitas ? `<button type="button" class="fv2-cab-acao" aria-pressed="${soFaltam}" onclick="alternarFaltasDoQuestionario('${esc(id)}')">${soFaltam ? `ver as ${questoes.length}` : `só as ${faltam} que faltam`}</button>` : ''}</div>
      ${questoes.length ? `<div class="fv2-tb fv2-linhas">${corpo}</div>` : fv2VazioHtml('lapis', 'O questionário ainda não tem perguntas', 'As perguntas chegam do servidor quando o onboarding estiver ligado.')}</section>`;

    const preencher = pode ? `<button type="button" class="d3m-btn l" onclick="abrirQuestionario('${esc(id)}','${n}')">Preencher agora</button><button type="button" class="d3m-btn l s" onclick="onboardingLink('${esc(id)}')">Mandar o link</button>` : '';
    const alto = !questoes.length ? ''
      : faltam ? fv2LaranjaHtml({ rotulo: !feitas ? 'questionário em branco' : faltam > feitas ? 'questionário pela metade' : 'faltam poucas', n: `${feitas} / ${questoes.length}`, titulo: 'perguntas respondidas',
        apoio: `${quando ? `A última vez foi em ${quando}. ` : ''}${faltam === 1 ? 'Falta 1.' : `Faltam ${faltam}.`}`, botoes: preencher })
      : fv2CalmoHtml('Questionário completo.', quando ? `Respondido pela última vez em ${quando}.` : 'Todas as perguntas têm resposta.',
        pode ? `<button type="button" class="d3v-btn vidro s" onclick="abrirQuestionario('${esc(id)}','${n}')">Rever as respostas</button>` : '');
    const f = typeof cadastroDoCliente === 'function' ? cadastroDoCliente(nome) : null;
    const completo = f && typeof completudeDoCadastro === 'function' ? completudeDoCadastro(f) : null;
    const abrir = fv2VlinHtml('Cadastro', completo ? `${completo.feitos} de ${completo.total} campos` : 'empresa, responsável e canais', "trocarAbaDaFicha('cadastro')")
      + fv2VlinHtml('Acessos', 'links, senhas e painel', "trocarAbaDaFicha('geral')")
      + (window.VybeCarteira?.abrir ? fv2VlinHtml('Esteira de entrada', 'etapas e kickoff', "window.VybeCarteira.abrir('onboarding', { abas: ['onboarding'] })") : '');
    const lado = alto + fv2ConsHtml('Para onde vai cada coisa', '', '<p class="fv2-nota-lado">As respostas ficam aqui e alimentam o cérebro do cliente. Empresa, responsável e canais vão para o Cadastro; os acessos, para o cofre.</p>')
      + (partes.length ? fv2ConsHtml('Por parte', plural(questoes.length, 'pergunta', 'perguntas'), fv2BarrasHtml(partes.map((p) => ({ rotulo: p.titulo.replace(/^Sobre /, '').replace(/^./, (l) => l.toUpperCase()), n: p.ok, de: p.todas.length, lado: `${p.ok} / ${p.todas.length}`, tom: 'g' })))) : '')
      + fv2ConsHtml('Abrir', '', abrir);
    return fv2DuasHtml('onboarding', folha, lado);
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
  // ── tela Reuniões (prancha V2-M-Reunioes, 16/11/2026) ─────────────────────────────────────────────────────
  // Lateral → Clientes → Reuniões abre uma janela: a folha com todas as reuniões dos clientes ativos, o laranja do Mateus
  // e, no vidro, a consulta; o formulário de Nova reunião (os mesmos campos e a mesma gravação de antes) abre no vidro.
  // As reuniões vêm da leitura por cliente que a ficha já usava (area=reunioes&cliente=…), feita para cada cliente ativo.
  const tela = { raiz: null, janela: null, antes: null, form: false, filtro: 'todas', tipo: '', busca: '', inteira: false, lendo: false, quadro: 0 };
  const NA_FRENTE = 12;
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
    // Uma chamada para todos (clientes=); se o servidor não tiver essa leitura, um por cliente como antes.
    const faltam = await carregarLote(ids);
    let i = 0;
    const fila = async () => { while (i < faltam.length) { const id = faltam[i]; i += 1; await carregar(id, forcar); } };
    await Promise.all(Array.from({ length: Math.min(6, faltam.length) }, fila));
    tela.lendo = false;
    pintarTela();
  }
  // Devolve os ids que ficaram sem leitura (todos, quando a rota de vários não respondeu).
  async function carregarLote(ids) {
    const faltam = [];
    for (let k = 0; k < ids.length; k += 200) {
      const parte = ids.slice(k, k + 200);
      try {
        const r = await fetch(`/api/painel?area=reunioes&clientes=${parte.map(encodeURIComponent).join(',')}`, { credentials: 'same-origin', cache: 'no-store' });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.clientes || typeof d.clientes !== 'object') { faltam.push(...parte); continue; }
        const comuns = { tipos: d.tipos, questoes: d.questoes, acessos_pedidos: d.acessos_pedidos };
        for (const id of parte) {
          const x = d.clientes[id];
          if (!x) { faltam.push(id); continue; }
          dados[id] = x.ok === false ? { erro: x.error || 'Não consegui ler as reuniões.' } : { d: { ...x, ...comuns } };
        }
      } catch { faltam.push(...parte); }
    }
    return faltam;
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

  // Prancha V2-M-Reunioes (16/11/2026): o esqueleto dos módulos V2. À esquerda, uma folha com as reuniões (as marcadas
  // primeiro, depois as feitas; a linha abre no lugar com a pauta, a ata, a gravação e o que fazer) e o pé "De olho". No
  // vidro, o cartão laranja do que pede ação (demandas sugeridas, ata faltando ou clientes sem a próxima reunião), o que
  // uma reunião guarda, os tipos do mês (o clique filtra) e "Abrir". "Nova reunião" abre o formulário de sempre no vidro.
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const VAI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  const fotoCli = (nome) => {
    if (typeof fotoDoClienteCv2 === 'function') return fotoDoClienteCv2(nome);
    let h = 7; for (const ch of String(nome || '')) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
    return `<i class="d3v-foto cv2-foto" style="--h:${h % 360}" aria-hidden="true">${esc(iniciais(nome))}</i>`;
  };
  const diaSemana = (iso) => SEMANA[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  const quandoLonga = (iso, hoje) => { const d = diasEntre(hoje, iso); return d === 0 ? `hoje, ${diaMes(iso)}` : d === 1 ? `amanhã, ${diaMes(iso)}` : d > 1 ? `${diaSemana(iso)} ${diaMes(iso)}` : diaMes(iso); };
  const btnR = (rotulo, attrs) => `<button type="button" class="rv2-btn" ${attrs}>${esc(rotulo)}</button>`;
  const btnLar = (rotulo, attrs, segundo = false) => `<button type="button" class="d3m-btn l${segundo ? ' s' : ''}" ${attrs}>${esc(rotulo)}</button>`;
  const vlin = (forte, apoio, attrs) => `<button type="button" class="d3m-vlin" ${attrs}><span><b>${esc(forte)}</b>${apoio ? ` · ${esc(apoio)}` : ''}</span>${VAI}</button>`;
  const consulta = (titulo, lado, dentro) => `<section class="d3m-cons"><div class="d3m-cons-cab"><b>${esc(titulo)}</b><span>${esc(lado)}</span></div>${dentro}</section>`;
  // Os clientes ativos que não têm a próxima reunião marcada (só depois de ler as reuniões de todos).
  const semProxima = (n) => clientesAtivos().filter((c) => !((dados[c.id]?.d?.reunioes) || []).some((r) => r.data > n.hoje));
  // O cartão laranja, só com ação: demandas sugeridas esperando o ok, reunião feita sem ata e, sem nada disso, os clientes
  // sem a próxima reunião. Sem ação, a frase calma no vidro (acabamento 15/11).
  function laranjaDaTela(n) {
    const laranja = (rotulo, num, frase, apoio, botoes) => `<section class="d3-acao d3m-laranja rv2-laranja" aria-label="O que pede ação agora"><span class="d3m-lar-rot"><span class="d3-acao-av" aria-hidden="true">M</span>Mateus · ${esc(rotulo)}</span>
      <span class="d3m-lar-txt"><b class="d3m-lar-num">${num}</b><span class="d3-acao-frase">${frase}</span>${apoio ? `<small>${apoio}</small>` : ''}<span class="d3m-lar-bts">${botoes}</span></span></section>`;
    const calmo = (frase, texto) => `<section class="rv2-calmo" aria-label="Leitura do Mateus"><b>${frase}</b><span>${texto}</span></section>`;
    if (tela.lendo && !n.lista.length) return calmo('Lendo as reuniões…', 'Uma leitura por cliente ativo.');
    if (n.sugeridas) return laranja('do VYBES', n.sugeridas, n.sugeridas === 1 ? 'demanda sugerida espera seu ok' : 'demandas sugeridas esperam seu ok',
      `Saíram ${n.comSugestao.length === 1 ? `da reunião de ${esc(n.comSugestao[0].nome)}` : `de ${n.comSugestao.length} reuniões`}. Confira antes de virar demanda.`,
      btnLar(n.sugeridas === 1 ? 'Ver a demanda' : `Ver as ${n.sugeridas}`, 'data-v2r-acao="demandas"'));
    if (n.semAta.length) { const antiga = n.semAta[0], dias = diasEntre(antiga.r.data, n.hoje);
      return laranja('falta a ata', n.semAta.length, n.semAta.length === 1 ? 'reunião feita sem ata' : 'reuniões feitas sem ata',
        `A mais antiga é a de ${esc(antiga.nome)}, ${dias ? `há ${plural(dias, 'dia', 'dias')}` : 'de hoje'}.${antiga.r.sugestoes?.resumo ? ' O resumo do VYBES está pronto.' : ''}`,
        btnLar(n.semAta.length === 1 ? 'Ver a reunião' : `Ver as ${n.semAta.length}`, 'data-v2r-acao="filtro" data-valor="sem-ata"') + btnLar('Nova reunião', 'data-v2r-acao="nova"', true)); }
    if (!n.lista.length) return laranja('nenhuma reunião', 0, 'reuniões registradas', 'Marque a primeira: a pauta vem sugerida com o que o sistema sabe do cliente.', btnLar('Marcar a primeira', 'data-v2r-acao="nova"'));
    const faltam = tela.lendo ? [] : semProxima(n);
    if (faltam.length) { const total = clientesAtivos().length, mes = n.hoje.slice(0, 7), feitas = n.lista.filter((x) => String(x.r.data).startsWith(mes) && x.r.data <= n.hoje);
      return laranja('falta marcar', faltam.length, faltam.length === 1 ? 'cliente sem a próxima reunião' : 'clientes sem a próxima reunião',
        `${feitas.length && feitas.every((x) => x.r.ata) ? `As ${feitas.length} de ${MESES[Number(mes.slice(5, 7)) - 1]} têm ata. ` : ''}${total - faltam.length ? `${plural(total - faltam.length, 'cliente já tem', 'clientes já têm')} a próxima marcada.` : 'Nenhum cliente tem a próxima marcada.'}`,
        btnLar('Nova reunião', 'data-v2r-acao="nova"') + btnLar(faltam.length === 1 ? `Ver ${faltam[0].nome}` : `Ver os ${faltam.length}`, 'data-v2r-acao="sem-proxima" aria-haspopup="listbox"', true)); }
    return calmo('Todas as feitas têm ata e todo cliente tem a próxima.', `${plural(n.daSemana.length, 'reunião', 'reuniões')} esta semana.`);
  }
  // A coluna do vidro: o laranja, o que uma reunião guarda, os tipos do mês (o clique filtra a folha) e "Abrir".
  function ladoDaTela(n) {
    const mes = n.hoje.slice(0, 7), doMes = n.lista.filter((x) => String(x.r.data).startsWith(mes));
    const tipos = Object.entries(TIPOS_PADRAO).map(([k, rotulo]) => [k, rotulo, doMes.filter((x) => x.r.tipo === k).length]);
    const maior = Math.max(1, ...tipos.map(([, , q]) => q));
    const barras = `<div class="rv2-barras" role="group" aria-label="Filtrar por tipo">${tipos.map(([k, rotulo, q]) => `<button type="button" class="rv2-barra-lin" data-v2r-acao="tipo" data-valor="${esc(k)}" aria-pressed="${tela.tipo === k}"><span>${esc(rotulo)}</span><span class="d3m-vbarra"><i style="--v:${Math.round((q / maior) * 100)}%"></i></span><b>${q}</b></button>`).join('')}</div>`;
    const ir = typeof window.mundoVoxel?.irPara === 'function';
    const abrir = [ir ? vlin('Agenda', 'reuniões e captações', 'data-v2r-acao="ir" data-valor="agenda"') : '', ir ? vlin('Onboarding', 'kickoffs e questionário', 'data-v2r-acao="ir" data-valor="onboarding"') : '',
      tela.tipo ? vlin('Todos os tipos', 'tirar o filtro', 'data-v2r-acao="tipo" data-valor=""') : ''].join('');
    return `${laranjaDaTela(n)}${consulta('Uma reunião guarda', '', '<p class="rv2-nota">Pauta, ata e a gravação do áudio. O VYBES transcreve e sugere as demandas que saíram dela.</p>')}
      ${consulta('Tipos', MESES[Number(mes.slice(5, 7)) - 1], barras)}${abrir ? consulta('Abrir', '', abrir) : ''}`;
  }
  // A folha: cabeçalho com as fichas, as colunas, as linhas (marcadas primeiro, a mais próxima no alto; depois as feitas,
  // a mais recente no alto) e o pé "De olho".
  function linhasDaTela(n) {
    if (!n.lista.length) return tela.lendo ? '<div class="fv2-vazio"><b>Lendo as reuniões…</b></div>'
      : `<div class="fv2-vazio"><b>Nenhuma reunião ainda.</b><span>A pauta vem sugerida com o que o sistema sabe do cliente; a gravação vai para o Drive.</span>${btnR('Marcar a primeira', 'data-v2r-acao="nova"')}</div>`;
    const termo = tela.busca.trim().toLowerCase();
    const passa = (x) => (!termo || `${x.nome} ${x.r.titulo}`.toLowerCase().includes(termo)) && (!tela.tipo || x.r.tipo === tela.tipo)
      && (tela.filtro === 'semana' ? x.r.data >= n.ini && x.r.data <= n.fim : tela.filtro === 'sem-ata' ? x.r.data <= n.hoje && !x.r.ata : true);
    // Primeiro o que vem (a mais próxima no alto), depois o que já foi (a mais recente no alto).
    const filtradas = n.lista.filter(passa);
    const futuras = filtradas.filter((x) => x.r.data >= n.hoje).sort((a, b) => a.r.data.localeCompare(b.r.data));
    const passadas = filtradas.filter((x) => x.r.data < n.hoje).sort((a, b) => b.r.data.localeCompare(a.r.data));
    const ordem = [...futuras, ...passadas];
    if (!ordem.length) return `<div class="fv2-vazio"><b>Nenhuma reunião com esse filtro.</b>${btnR('Ver todas', 'data-v2r-acao="filtro" data-valor="todas"')}</div>`;
    const corte = tela.inteira || termo ? ordem.length : Math.max(futuras.length, Math.min(NA_FRENTE, ordem.length));
    const grupoDe = (x) => (x.r.data >= n.hoje ? (x.r.data <= n.fim ? 'Semana' : 'Depois') : 'Feitas');
    let ultimo = '';
    const linha = (x) => { const r = x.r, futura = r.data >= n.hoje, pend = pendentesDe(r), feitas = (r.sugestoes?.cadastradas || []).length, g = grupoDe(x), rot = g !== ultimo ? g : ''; ultimo = g;
      const ata = futura ? `<span class="fv2-est">${r.pauta ? 'com pauta' : 'pauta sugerida'}</span>` : r.ata ? '<span class="fv2-est g"><i aria-hidden="true"></i>com ata</span>'
        : `<span class="fv2-est r"><i aria-hidden="true"></i>sem ata${r.sugestoes?.resumo ? ' · resumo pronto' : ''}</span>`;
      const demanda = pend ? `<button type="button" class="rv2-dem-b" data-v2r-acao="ficha" data-cli="${esc(x.id)}" data-v2r-conferir>${pend === 1 ? '1 sugerida' : `${pend} sugeridas`}</button>`
        : `<span class="rv2-dem-t">${futura ? '' : feitas ? plural(feitas, 'demanda', 'demandas') : 'nenhuma'}</span>`;
      const principal = !x.pode ? btnR('Abrir na ficha', `data-v2r-acao="ficha" data-cli="${esc(x.id)}"`)
        : !futura && !r.ata && r.sugestoes?.resumo ? `<button type="button" class="rv2-btn" data-v2r-acao="resumo" data-cli="${esc(x.id)}" data-reu="${esc(r.id)}" title="Abre a ata já preenchida com o resumo, para conferir e salvar">Usar o resumo</button>`
        : btnR(!futura && !r.ata ? 'Escrever a ata' : 'Abrir a reunião', `data-v2r-acao="ata" data-cli="${esc(x.id)}" data-reu="${esc(r.id)}"`);
      const dias = diasEntre(r.data, n.hoje);
      return `<div class="v2-abre rv2-linha" aria-expanded="false" data-reu-linha="${esc(r.id)}"><div class="rv2-lin">
          <button type="button" class="rv2-abrir" data-v2r-acao="linha" aria-expanded="false" aria-label="${esc(`${x.nome}: ${r.titulo || 'reunião'}, ${quandoLonga(r.data, n.hoje)}`)}">
            <span class="rv2-rot${g === 'Semana' ? ' a' : ''}">${rot}</span>${fotoCli(x.nome)}<span class="rv2-nm"><b>${esc(x.nome)}</b> <span>· ${esc(r.titulo || TIPOS_PADRAO[r.tipo] || 'Reunião')}</span></span>
            <span class="rv2-quando">${esc(quandoLonga(r.data, n.hoje))}</span><span class="rv2-quem">${avsHtml(r.participantes)}</span>${ata}</button>
          <span class="rv2-dem">${demanda}</span><span class="rv2-seta" aria-hidden="true">${VAI}</span></div>
        <div class="v2-mais"><div><div class="rv2-det">
          <p><b>Pauta</b> · ${r.pauta ? esc(String(r.pauta).split('\n').map((l) => l.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean).join(' · ').slice(0, 220)) : futura ? 'a pauta sugerida vem pronta ao abrir' : 'sem pauta escrita'}</p>
          <p><b>Ata</b> · ${r.ata ? esc(String(r.ata).slice(0, 220)) : futura ? 'depois da reunião' : `em branco ${dias ? `há ${plural(dias, 'dia', 'dias')}` : 'desde hoje'}${r.sugestoes?.resumo ? '; o resumo do VYBES está pronto' : r.gravacao ? '; o resumo ainda não chegou' : ''}`}</p>
          <p><b>Gravação</b> · ${r.gravacao ? `na pasta Reuniões do cliente no Drive${r.transcricao ? ', já transcrita' : ''}` : 'não foi gravada'}</p>
          <div class="rv2-botoes">${principal}${r.gravacao ? `<a class="rv2-btn" href="https://drive.google.com/file/d/${esc(r.gravacao.id)}/view" target="_blank" rel="noopener">Ouvir a gravação</a>` : ''}${
            r.transcricao ? btnR('Ler a transcrição', `data-v2r-acao="ficha" data-cli="${esc(x.id)}"`) : ''}${pend ? btnR(`Conferir ${pend === 1 ? 'a demanda' : `as ${pend} demandas`}`, `data-v2r-acao="ficha" data-cli="${esc(x.id)}"`) : ''}</div>
        </div></div></div></div>`; };
    return ordem.slice(0, corte).map(linha).join('');
  }
  function olhoDaTela(n, resto) {
    const mes = n.hoje.slice(0, 7), feitas = n.lista.filter((x) => String(x.r.data).startsWith(mes) && x.r.data <= n.hoje), semAta = feitas.filter((x) => !x.r.ata).length;
    return `<span class="rv2-olho-rot">De olho</span>
      <span class="rv2-olho-i"><b class="${feitas.length ? 'g' : ''}">${feitas.length}</b><small>${feitas.length === 1 ? 'feita' : 'feitas'} em ${MESES[Number(mes.slice(5, 7)) - 1]}${feitas.length ? (semAta ? `, ${semAta} sem ata` : feitas.length === 1 ? ', com ata' : ', todas com ata') : ''}</small></span>
      ${n.sugeridas ? `<button type="button" class="rv2-olho-i" data-v2r-acao="demandas"><b class="r">${n.sugeridas}</b><small>${n.sugeridas === 1 ? 'demanda sugerida esperando' : 'demandas sugeridas esperando'}</small></button>` : '<span class="rv2-olho-i"><b>0</b><small>demandas sugeridas esperando</small></span>'}
      ${resto > 0 ? `<button type="button" class="rv2-olho-i" data-v2r-acao="mostrar"><b>+ ${resto}</b><small>${resto === 1 ? 'reunião anterior' : 'reuniões anteriores'}</small></button>` : ''}`;
  }
  function formDaTela() {
    const opcoesTipo = Object.entries(TIPOS_PADRAO).map(([k, v]) => `<option value="${k}" ${k === 'rotina' ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return `<div class="rv2-cab"><h3>Nova reunião</h3><button type="button" class="rv2-btn" data-v2r-acao="fechar-form" aria-label="Fechar Nova reunião">Fechar</button></div>
      <div class="rv2-campos"><div class="rv2-cp"><label for="reu-cliente">Cliente</label>
          <select class="rv2-inp" id="reu-cliente" onchange="trocarClienteDaReuniao(this.value)" required><option value="">Escolha o cliente</option>${clientesAtivos().map((c) => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}</select></div>
        <div class="rv2-g2"><div class="rv2-cp"><label for="reu-tipo">Tipo</label><select class="rv2-inp" id="reu-tipo">${opcoesTipo}</select></div>
          <div class="rv2-cp"><label for="reu-data">Data</label><input class="rv2-inp" id="reu-data" type="date" value="${esc(hojeIso())}"></div></div>
        <div class="rv2-cp"><label for="reu-titulo">Título</label><input class="rv2-inp" id="reu-titulo" type="text" maxlength="160" placeholder="Ex.: Entrada da Lil"></div>
        <div class="rv2-cp"><label for="reu-participantes">Participantes</label>
          <div class="rv2-inp rv2-pt"><span class="v2r-avs" data-v2r-avs aria-hidden="true"></span><input class="rv2-nu" id="reu-participantes" type="text" maxlength="600" placeholder="Quem estava" autocomplete="off"></div></div>
        <div class="rv2-cp"><label for="reu-pauta">Pauta <span class="rv2-sugerida" title="Sugerida com o que o sistema sabe do cliente. Edite à vontade.">sugerida</span></label><textarea class="rv2-inp" id="reu-pauta" rows="3"></textarea></div>
        <div class="rv2-cp"><label for="reu-ata">Ata</label><textarea class="rv2-inp" id="reu-ata" rows="3" placeholder="O que foi falado, o que ficou decidido, próximos passos e responsáveis"></textarea></div>
        <p class="ciclo-erro" id="reu-erro" role="alert"></p></div>
      <div class="rv2-form-pe"><button type="button" class="rv2-btn" data-v2r-acao="fechar-form">Cancelar</button>
        <button type="button" class="rv2-btn" ${gravando ? 'disabled' : ''} title="O áudio vai para a pasta Reuniões do cliente no Drive; o VYBES devolve a transcrição, o resumo e as demandas sugeridas na ficha." onclick="salvarReuniao('', '', true)">Salvar e gravar</button>
        <button type="button" class="rv2-btn k" onclick="salvarReuniao('', '')">Salvar</button></div>`;
  }
  function pintarForm() {
    const alvo = tela.janela?.querySelector('[data-v2r="form"]');
    if (!alvo) return;
    alvo.hidden = !tela.form;
    alvo.innerHTML = tela.form ? formDaTela() : '';
    tela.janela.querySelector('.rv2-duas')?.classList.toggle('com-form', Boolean(tela.form));
  }
  function pintarTela() {
    if (!tela.janela) return;
    cancelAnimationFrame(tela.quadro);
    tela.quadro = requestAnimationFrame(() => {
      const j = tela.janela; if (!j) return;
      const n = numerosDaTela(), mes = n.hoje.slice(0, 7);
      const abertas = new Set([...j.querySelectorAll('.rv2-linha[aria-expanded="true"]')].map((b) => b.dataset.reuLinha));
      const faltam = tela.lendo ? null : semProxima(n);
      j.querySelector('[data-v2r="sub"]').textContent = [new Date(`${n.hoje}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(/-feira/, ''), `${n.daSemana.length} ${n.daSemana.length === 1 ? 'marcada' : 'marcadas'} na semana`,
        faltam ? `${plural(faltam.length, 'cliente', 'clientes')} sem a próxima` : ''].filter(Boolean).join(' · ');
      const feitasMes = n.lista.filter((x) => String(x.r.data).startsWith(mes) && x.r.data <= n.hoje).length;
      j.querySelector('[data-v2r="titulo-lista"]').innerHTML = `Reuniões<span> · ${n.daSemana.length} nesta semana, ${feitasMes} ${feitasMes === 1 ? 'feita' : 'feitas'} em ${MESES[Number(mes.slice(5, 7)) - 1]}</span>`;
      const conta = { todas: n.lista.length, semana: n.daSemana.length, 'sem-ata': n.semAta.length };
      j.querySelector('[data-v2r="chips"]').innerHTML = n.lista.length ? [['todas', 'Todas'], ['semana', 'Esta semana'], ['sem-ata', 'Sem ata']].map(([k, r]) =>
        `<button type="button" class="rv2-chip" data-v2r-acao="filtro" data-valor="${k}" aria-pressed="${tela.filtro === k}">${r}<span>${conta[k]}</span></button>`).join('') : '';
      const html = linhasDaTela(n), alvo = j.querySelector('[data-v2r="linhas"]');
      alvo.innerHTML = html;
      j.querySelectorAll('.rv2-linha').forEach((b) => { if (abertas.has(b.dataset.reuLinha)) { b.setAttribute('aria-expanded', 'true'); b.querySelector('.rv2-abrir')?.setAttribute('aria-expanded', 'true'); } });
      j.querySelector('.rv2-th').hidden = !alvo.querySelector('.rv2-linha');
      const termo = tela.busca.trim(), mostradas = alvo.querySelectorAll('.rv2-linha').length;
      const filtradas = n.lista.filter((x) => (!tela.tipo || x.r.tipo === tela.tipo) && (tela.filtro === 'semana' ? x.r.data >= n.ini && x.r.data <= n.fim : tela.filtro === 'sem-ata' ? x.r.data <= n.hoje && !x.r.ata : true)).length;
      j.querySelector('[data-v2r="olho"]').innerHTML = olhoDaTela(n, termo || tela.inteira ? 0 : Math.max(0, filtradas - mostradas));
      j.querySelector('[data-v2r="lado"]').innerHTML = ladoDaTela(n);
      // Sem reunião, "Marcar a primeira" do laranja é a ação; o "Nova reunião" do alto some para não repetir (acabamento 15/11).
      const novaTopo = j.querySelector('.rv2-topo [data-v2r-acao="nova"]'); if (novaTopo) novaTopo.hidden = !n.lista.length && !tela.lendo;
      const bf = j.querySelector('.rv2-topo [data-v2r-acao="tipos"]');
      if (bf) { bf.setAttribute('aria-pressed', String(Boolean(tela.tipo))); bf.title = tela.tipo ? `Tipo: ${TIPOS_PADRAO[tela.tipo] || tela.tipo}` : 'Filtrar por tipo'; }
    });
  }
  function abrirFormDaTela(clienteId = '') {
    if (!tela.form) { tela.form = true; pintarForm(); }
    const campo = tela.janela?.querySelector('#reu-cliente');
    if (campo && clienteId) { campo.value = String(clienteId); window.trocarClienteDaReuniao?.(String(clienteId)); }
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
    if (acao === 'tipo') { tela.tipo = tela.tipo === d.valor ? '' : d.valor; tela.inteira = false; return pintarTela(); }
    if (acao === 'mostrar') { tela.inteira = true; return pintarTela(); }
    if (acao === 'linha') { const bloco = b.closest('.v2-abre'), abre = bloco.getAttribute('aria-expanded') !== 'true';
      bloco.setAttribute('aria-expanded', String(abre)); b.setAttribute('aria-expanded', String(abre)); return; }
    if (acao === 'ficha') return irParaFicha(d.cli);
    if (acao === 'ir') { fecharTela({ foco: false }); return window.mundoVoxel?.irPara?.(d.valor); }
    if (acao === 'demandas') { const alvos = [...tela.janela.querySelectorAll('[data-v2r-conferir]')];
      if (alvos.length === 1) return irParaFicha(alvos[0].dataset.cli);
      alvos[0]?.scrollIntoView?.({ block: 'center' }); alvos[0]?.focus(); return; }
    if (acao === 'ata' || acao === 'resumo') { const nome = nomeDoId(d.cli);
      const r = (dados[d.cli]?.d?.reunioes || []).find((x) => x.id === String(d.reu));
      const s = r?.sugestoes;
      const texto = acao === 'resumo' && s ? [s.resumo, (s.decisoes || []).length ? `Decisões:\n${s.decisoes.map((x) => `- ${x}`).join('\n')}` : ''].filter(Boolean).join('\n\n') : '';
      return window.abrirReuniao(nome, d.reu, texto ? { ata: texto } : {}); }
    // Os clientes sem a próxima reunião: a lista do painel; escolher um abre "Nova reunião" com ele.
    if (acao === 'sem-proxima' && typeof abrirListaDoPainel === 'function') { const n = numerosDaTela();
      return abrirListaDoPainel(b, { titulo: 'Sem a próxima reunião', atual: '', opcoes: semProxima(n).map((c) => ({ valor: String(c.id), rotulo: c.nome })), aoEscolher: (valor) => abrirFormDaTela(valor) }); }
    if (acao === 'tipos' && typeof abrirListaDoPainel === 'function') return abrirListaDoPainel(b, { titulo: 'Filtrar por tipo', atual: tela.tipo,
      opcoes: [{ valor: '', rotulo: 'Todos os tipos' }, ...Object.entries(TIPOS_PADRAO).map(([valor, rotulo]) => ({ valor, rotulo }))],
      aoEscolher: (valor) => { tela.tipo = valor; tela.inteira = false; pintarTela(); } });
  }
  function aoDigitarNaTela(e) {
    if (e.target.matches?.('[data-v2r-busca]')) { tela.busca = e.target.value; e.target.classList.toggle('tem', Boolean(tela.busca)); pintarTela(); }
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
      // Prancha V2: a folha das reuniões ocupa a tela; "Nova reunião" abre o formulário no vidro.
      tela.form = false;
      Object.assign(tela, { filtro: 'todas', tipo: '', busca: '', inteira: false });
      const raiz = document.createElement('div'), janela = document.createElement('section');
      raiz.className = 'vc-camada v2r-camada';
      janela.id = 'vv-reunioes';
      janela.className = 'vc-janela rv2-janela';
      janela.setAttribute('role', 'dialog');
      janela.setAttribute('aria-modal', 'true');
      janela.setAttribute('aria-labelledby', 'v2r-titulo');
      janela.innerHTML = `<div class="rv2">
        <div class="rv2-topo"><div class="rv2-tit"><h2 id="v2r-titulo">Reuniões</h2><span data-v2r="sub"></span></div>
          <label class="rv2-busca"><span class="rv2-so-leitor">Buscar reunião por cliente ou título</span><input id="v2r-busca" type="search" data-v2r-busca placeholder="Buscar reunião" autocomplete="off"></label>
          <button type="button" class="rv2-ico" data-v2r-acao="tipos" aria-haspopup="listbox" aria-pressed="false" aria-label="Filtrar por tipo" title="Filtrar por tipo"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/></svg></button>
          <button type="button" class="rv2-novo" data-v2r-acao="nova"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>Nova reunião</button>
          <button type="button" class="rv2-x" data-v2r-acao="fechar" aria-label="Fechar" title="Fechar (Esc)">${XIS}</button></div>
        <div class="fv2-duas rv2-duas">
          <div class="fv2-col"><section class="fv2-folha rv2-lista" aria-label="Reuniões">
            <div class="rv2-cab"><h3 data-v2r="titulo-lista">Reuniões</h3><span class="rv2-chips" role="group" aria-label="Filtrar as reuniões" data-v2r="chips"></span></div>
            <div class="rv2-th" aria-hidden="true" hidden><span class="rv2-th-l"><span></span><span></span><span>Cliente e título</span><span>Quando</span><span>Quem</span><span>Ata</span></span><span>Viraram demanda</span><span></span></div>
            <div class="rv2-linhas" data-v2r="linhas"></div>
            <div class="rv2-olho" data-v2r="olho"></div></section></div>
          <aside class="d3m-lado fv2-lado" aria-label="Consulta"><div class="rv2-lado" data-v2r="lado"></div>
            <section class="fv2-folha rv2-form" data-v2r="form" aria-label="Nova reunião" hidden></section></aside>
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
