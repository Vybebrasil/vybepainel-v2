// vybe-mundo-cliente.js — o Centro de Operação do cliente na placa do Irecity.
//
// Clicar num cliente na cidade abre a placa (mostrarCliente, vybe-mundo.js). Estes blocos levam
// para ela o que o Centro de Operação do Escritório mostrava (abrirAgenteOperacaoEscritorio e
// escritorioListasDoAgente, vybe-escritorio.js) e ainda faltava no Irecity:
//   · Esperando o cliente: peças cuja próxima ação é do cliente (a mesma regra do radar de risco,
//     riskActionOwner em vybe-risco.js) e há quantos dias estão paradas (status_updated_at).
//   · Esta semana: peças com veiculação de segunda a domingo e a meta de 3 posts por semana.
//   · Próximas 4 semanas: mini calendário das veiculações, um ponto por peça.
//   · Planejamentos: a mesma consulta da ficha do cliente (pljPedir, vybe-planejamentos.js) e o
//     link do cadastro (planejamento_url), quando houver.
//   · Desativar e Apagar para sempre: as janelas do ciclo de vida (vybe-ciclo.js), só para quem
//     administra, com os mesmos argumentos do Escritório e do subsolo.
// Nada aqui grava: os cliques abrem as janelas de sempre (openItemWorkspace, abrirPlanejamento,
// abrirDesativarNoCiclo, abrirApagarNoCiclo), e quem grava e confere é o servidor.
//
// Uso em mostrarCliente: no fim do HTML da placa, `${window.VybeClientePlaca?.html(c.nome) || ''}`;
// depois de pôr na tela, `window.VybeClientePlaca?.ligar(p)`. Visual em vybe-mundo-cliente.css.
(() => {
  const G = typeof window !== 'undefined' ? window : globalThis;

  // Meta da agência: 3 posts por cliente por semana (a mesma da Visão do dono).
  const META_SEMANA = 3;
  // Parada há mais que isto (dias) fica âmbar na lista "Esperando o cliente".
  const PARADA_DIAS = 3;
  const MAX_LINHAS = 5;
  const MAX_SEMANA = 7;
  const SEMANAS = 4;
  const DIAS_CURTOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  // Os status em que quem destrava é o cliente: a lista de riskActionOwner (vybe-risco.js), a mesma
  // do "esperando o cliente" do Centro de Operação. tests/mundo-cliente.test.mjs confere que
  // continuam iguais. "Para aprovação" é a aprovação interna (fica com a agência).
  const ESPERA_DO_CLIENTE = Object.freeze(['Falta Info', 'Ag. Info Cliente', 'Aguardo', 'Ag. Aprovação Cliente']);
  // Estado do planejamento → escala de urgência (docs/padrao-visual.md, item 3).
  const NIVEL_DO_PLANEJAMENTO = { revisar: 'u2', ajustes: 'u3a', enviado: 'u4', aprovado: 'u6', cadastrado: 'u6', arquivado: 'u5' };

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
  const lista = (v) => (Array.isArray(v) ? v : []);
  const chamar = (nome, ...a) => (typeof G[nome] === 'function' ? G[nome](...a) : undefined);
  const souAdminAqui = () => { try { return typeof souAdmin === 'function' && Boolean(souAdmin()); } catch { return false; } };

  // ---------- Datas: dias sem hora, sem deslocamento de fuso ----------
  const pad = (n) => String(n).padStart(2, '0');
  const dataLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hojeIso = () => (typeof hojeDeVerdade === 'function' ? hojeDeVerdade() : dataLocal(new Date()));
  const dia = (v) => { const s = String(v || '').slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; };
  const meioDia = (iso) => new Date(`${iso}T12:00:00Z`);
  const somar = (iso, n) => { const x = meioDia(iso); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const segundaDe = (iso) => somar(iso, -((meioDia(iso).getUTCDay() + 6) % 7));
  const diasEntre = (de, ate) => Math.round((meioDia(ate) - meioDia(de)) / 864e5);
  const diaMes = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const diaDaSemana = (iso) => DIAS_CURTOS[(meioDia(iso).getUTCDay() + 6) % 7];
  // status_updated_at vem com hora: o dia é o do relógio local, como em hojeDeVerdade.
  function diaDoCarimbo(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : dataLocal(d);
  }

  // ---------- Peças do cliente, pelas regras do painel ----------
  function todasAsPecas() {
    // Conteúdos e solicitações juntos, sem repetir (a mesma fonte do Centro de Operação).
    if (typeof unifiedOperationalItems === 'function') { try { return lista(unifiedOperationalItems()); } catch { /* cai para DADOS_ALL */ } }
    return lista(typeof DADOS_ALL !== 'undefined' ? DADOS_ALL : null);
  }
  const normCliente = (n) => (typeof normalizarCliente === 'function' ? normalizarCliente(String(n || '')) : String(n || '').trim());
  const chaveCliente = (n) => normCliente(n).toLowerCase();
  const clientesDe = (d) => (typeof clientesDoItem === 'function' ? clientesDoItem(d) : (Array.isArray(d?.clientes) ? d.clientes : [d?.cliente]).filter(Boolean));
  const ehSolicitacao = (d) => (typeof isRequestItem === 'function' ? isRequestItem(d) : d?.origem === 'solicitacao');
  const statusDoFluxo = (d) => (typeof operationalFlowStatus === 'function' ? operationalFlowStatus(d) : String(d?.status || '').trim());
  const fechada = (d) => (typeof isFinishedItem === 'function' ? isFinishedItem(d) : /^(finalizado|feito|conclu[ií]do)$/i.test(statusDoFluxo(d)));
  // Atraso é o do mundo inteiro (situacaoDaPecaNoMundo, vybe-mundo.js): veiculação ou prazo vencidos.
  function atrasada(d, hoje) {
    if (typeof G.situacaoDaPecaNoMundo === 'function') return G.situacaoDaPecaNoMundo(d, hoje) === 'atrasada';
    if (fechada(d)) return false;
    const veic = dia(d?.veiculacao_iso), prazo = dia(d?.prazo_iso);
    return Boolean((veic && veic < hoje) || d?.prazo_atrasado || (prazo && prazo < hoje));
  }
  const semResponsavel = (d) => !(lista(d?.responsavel_ids).length || d?.responsavel_id || String(d?.responsavel || '').replace(/[—–-]/g, '').trim());
  // Nível da escala de urgência (docs/padrao-visual.md, item 3) para a etiqueta de cada peça.
  function nivel(d, hoje) {
    if (fechada(d)) return 'u6';
    if (atrasada(d, hoje)) return 'u1';
    if (dia(d?.veiculacao_iso) === hoje || dia(d?.prazo_iso) === hoje) return 'u2';
    const st = statusDoFluxo(d);
    if (/altera|ajuste|corre/i.test(st)) return 'u3a';
    if (/falta|info/i.test(st)) return 'u3b';
    if (/aprova|aguardo/i.test(st)) return 'u4';
    if (semResponsavel(d)) return 'u5';
    return 'u6';
  }
  const esperaDoCliente = (d) => !fechada(d) && ESPERA_DO_CLIENTE.includes(statusDoFluxo(d));
  function diasParada(d, hoje) {
    const desde = diaDoCarimbo(d?.status_updated_at);
    if (desde) return Math.max(0, diasEntre(desde, hoje));
    const horas = Number(d?.operational_risk?.hours_in_status);
    return d?.operational_risk?.hours_in_status != null && Number.isFinite(horas) && horas >= 0 ? Math.floor(horas / 24) : null;
  }
  const quantoTempo = (n) => (n === null ? 'sem data da etapa' : n === 0 ? 'desde hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`);

  function cadastroDe(nome) {
    if (typeof cadastroDoCliente === 'function') { try { const c = cadastroDoCliente(nome); if (c) return c; } catch { /* procura abaixo */ } }
    const alvo = chaveCliente(nome);
    return lista(typeof CADASTRO_CLIENTES !== 'undefined' ? CADASTRO_CLIENTES : null).find((c) => chaveCliente(c?.nome) === alvo) || null;
  }
  function linkSeguro(v) {
    if (typeof linkDeCliente === 'function') return linkDeCliente(v);
    try { const u = new URL(String(v || '').trim()); return ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch { return ''; }
  }

  // ---------- Pedaços de HTML ----------
  const nota = (texto, extra = '') => `<p class="vv-cli-nota${extra ? ' ' + extra : ''}">${esc(texto)}</p>`;
  const rotulo = (texto, lado = '') => `<div class="vv-cli-rotulo"><span>${esc(texto)}</span>${lado}</div>`;
  const tituloDaPeca = (d) => String(d?.nome || d?.titulo || 'Peça sem título').trim();

  function linhaEspera(d, hoje) {
    const parada = diasParada(d, hoje), atr = atrasada(d, hoje);
    const u = atr ? 'u1' : parada !== null && parada > PARADA_DIAS ? 'u2' : nivel(d, hoje);
    const veic = dia(d.veiculacao_iso);
    const apoio = [statusDoFluxo(d), veic ? `veiculação ${diaMes(veic)}` : ''].filter(Boolean).join(' · ');
    return `<button type="button" class="vv-cli-linha ${u}" data-vv-cli-peca="${esc(d.id)}" title="${esc(`${tituloDaPeca(d)} · ${apoio}`)}">
      <span class="vv-cli-meio"><b>${esc(tituloDaPeca(d))}</b><small>${esc(apoio)}</small></span>
      <em class="vv-cli-tag ${u}">${esc(atr ? `atrasada · ${quantoTempo(parada)}` : quantoTempo(parada))}</em></button>`;
  }
  function linhaComDia(d, hoje) {
    const veic = dia(d.veiculacao_iso), u = nivel(d, hoje);
    const apoio = String(d.responsavel || '').trim() || 'sem responsável';
    return `<button type="button" class="vv-cli-linha${u === 'u1' || u === 'u2' ? ' ' + u : ''}" data-vv-cli-peca="${esc(d.id)}" title="${esc(`${tituloDaPeca(d)} · ${d.status || ''}`)}">
      <span class="vv-cli-quando${veic === hoje ? ' hoje' : ''}"><small>${veic === hoje ? 'Hoje' : diaDaSemana(veic)}</small><b>${esc(veic.slice(8, 10))}</b></span>
      <span class="vv-cli-meio"><b>${esc(tituloDaPeca(d))}</b><small>${esc(apoio)}</small></span>
      <em class="vv-cli-tag ${u}">${esc(d.status || 'Sem status')}</em></button>`;
  }

  function blocoEspera(pecas, hoje) {
    const esperando = pecas.filter(esperaDoCliente).map((d) => ({ d, atr: atrasada(d, hoje), parada: diasParada(d, hoje) }))
      .sort((a, b) => (a.atr === b.atr ? 0 : a.atr ? -1 : 1) || (b.parada ?? -1) - (a.parada ?? -1) || tituloDaPeca(a.d).localeCompare(tituloDaPeca(b.d)));
    const conta = `<span class="vv-cli-conta">${esperando.length}</span>`;
    return `<section class="vv-cli-secao" data-vv-cli-secao="espera">${rotulo('Esperando o cliente', conta)}
      ${esperando.length ? esperando.slice(0, MAX_LINHAS).map((x) => linhaEspera(x.d, hoje)).join('') : nota('Nada esperando o cliente agora.')}
      ${esperando.length > MAX_LINHAS ? nota(`e mais ${esperando.length - MAX_LINHAS} em Abrir o cliente`) : ''}</section>`;
  }

  function blocoSemana(conteudos, hoje) {
    const seg = segundaDe(hoje), dom = somar(seg, 6);
    const daSemana = conteudos.filter((d) => { const v = dia(d.veiculacao_iso); return v && v >= seg && v <= dom; })
      .sort((a, b) => dia(a.veiculacao_iso).localeCompare(dia(b.veiculacao_iso)) || tituloDaPeca(a).localeCompare(tituloDaPeca(b)));
    const n = daSemana.length, bateu = n >= META_SEMANA;
    const meta = `<span class="vv-cli-meta ${bateu ? 'ok' : 'falta'}" title="Meta: ${META_SEMANA} posts por semana">${n} de ${META_SEMANA}</span>`;
    return `<section class="vv-cli-secao" data-vv-cli-secao="semana">${rotulo(`Esta semana · ${diaMes(seg)} a ${diaMes(dom)}`, meta)}
      ${n ? daSemana.slice(0, MAX_SEMANA).map((d) => linhaComDia(d, hoje)).join('') : nota('Nenhuma peça com veiculação nesta semana.')}
      ${n > MAX_SEMANA ? nota(`e mais ${n - MAX_SEMANA} nesta semana`) : ''}</section>`;
  }

  function blocoCalendario(conteudos, hoje) {
    const inicio = segundaDe(hoje), fim = somar(inicio, SEMANAS * 7 - 1);
    const porDia = new Map();
    for (const d of conteudos) {
      const v = dia(d.veiculacao_iso);
      if (!v || v < inicio || v > fim) continue;
      if (!porDia.has(v)) porDia.set(v, []);
      porDia.get(v).push(d);
    }
    let total = 0;
    const celulas = Array.from({ length: SEMANAS * 7 }, (_, i) => {
      const iso = somar(inicio, i), pecas = porDia.get(iso) || [];
      total += pecas.length;
      const pontos = pecas.slice(0, 3).map((d) => `<i${fechada(d) ? ' class="feita"' : ''}></i>`).join('') + (pecas.length > 3 ? `<b>+${pecas.length - 3}</b>` : '');
      const classes = ['vv-cli-dia', iso === hoje ? 'hoje' : '', iso < hoje ? 'passado' : '', pecas.length ? 'tem' : ''].filter(Boolean).join(' ');
      // O dia 1 leva o mês (1/12): a virada aparece no meio da grade.
      const numero = iso.slice(8, 10) === '01' ? `1/${Number(iso.slice(5, 7))}` : Number(iso.slice(8, 10));
      return `<button type="button" class="${classes}" data-vv-cli-dia="${iso}" aria-pressed="false"${pecas.length ? '' : ' disabled'} aria-label="${esc(`${diaDaSemana(iso)} ${diaMes(iso)}${iso === hoje ? ', hoje' : ''}: ${pecas.length} ${pecas.length === 1 ? 'peça' : 'peças'}`)}"><span>${numero}</span><em>${pontos}</em></button>`;
    }).join('');
    const listas = [...porDia.keys()].sort().map((iso) => `<div class="vv-cli-dia-lista" data-vv-cli-lista="${iso}" hidden>
      ${porDia.get(iso).sort((a, b) => tituloDaPeca(a).localeCompare(tituloDaPeca(b))).map((d) => linhaComDia(d, hoje)).join('')}</div>`).join('');
    return `<section class="vv-cli-secao" data-vv-cli-secao="calendario">${rotulo('Próximas 4 semanas', `<span class="vv-cli-conta">${total} ${total === 1 ? 'peça' : 'peças'}</span>`)}
      <div class="vv-cli-cal" role="group" aria-label="Veiculações das próximas 4 semanas">${DIAS_CURTOS.map((d) => `<span class="vv-cli-cal-sem" aria-hidden="true">${d.charAt(0)}</span>`).join('')}${celulas}</div>
      ${total ? `<p class="vv-cli-nota" data-vv-cli-dica>Cada ponto é uma peça pela veiculação. Toque num dia com pontos para ver as peças.</p>${listas}` : nota('Nenhuma veiculação nas próximas 4 semanas.')}</section>`;
  }

  function blocoPlanejamentos(cad) {
    const id = cad?.id != null ? String(cad.id) : '';
    const consulta = id && typeof pljPedir === 'function';
    const url = linkSeguro(cad?.planejamento_url);
    let host = '';
    try { host = url ? new URL(url).hostname.replace(/^www\./, '') : ''; } catch { host = ''; }
    const link = url ? `<a class="vv-cli-linha" href="${esc(url)}" target="_blank" rel="noopener noreferrer" data-vv-cli-plj-link>
      <span class="vv-cli-meio"><b>Link do planejamento</b><small>${esc(host || 'no cadastro do cliente')}</small></span><em class="vv-cli-tag u5">no cadastro ↗</em></a>` : '';
    const caixa = consulta ? `<div class="vv-cli-plj" data-vv-cli-plj="${esc(id)}">${nota('Buscando os planejamentos…')}</div>`
      : nota(!id ? 'Este cliente ainda não tem cadastro no painel.' : url ? 'Só o link do cadastro: o planejamento não é acompanhado no painel.' : 'Os planejamentos não estão disponíveis nesta tela.');
    return `<section class="vv-cli-secao" data-vv-cli-secao="planejamentos">${rotulo('Planejamentos')}${caixa}${link}</section>`;
  }

  function blocoAcoes(cad) {
    if (!souAdminAqui() || cad?.id == null) return '';
    const inativo = cad.ativo === false || /inativ/i.test(String(cad.status || ''));
    // O servidor só apaga quem já foi desativado (server/ciclo-de-vida.js); o botão diz isso antes.
    return `<div class="vv-cli-acoes" data-vv-cli-secao="acoes">
      ${inativo ? '' : '<button type="button" class="vv-cli-perigo" data-vv-cli-desativar title="Desce para o subsolo: sai da cidade, das listas e do portal no Hub. Peças e histórico ficam; dá para reviver.">Desativar</button>'}
      <button type="button" class="vv-cli-perigo" data-vv-cli-apagar${inativo ? ' title="Apaga o cadastro para sempre: não tem volta."' : ' disabled aria-disabled="true" title="Só se apaga quem já foi desativado: desative antes."'}>Apagar para sempre</button>
      ${inativo ? '' : nota('Apagar para sempre só depois de desativar.')}</div>`;
  }

  // ---------- API ----------
  function html(nomeCliente) {
    const nome = normCliente(nomeCliente);
    if (!nome) return '';
    const hoje = hojeIso(), chave = chaveCliente(nome);
    const pecas = todasAsPecas().filter((d) => clientesDe(d).some((c) => chaveCliente(c) === chave));
    // Semana e calendário contam posts: só conteúdos (solicitação não é post).
    const conteudos = pecas.filter((d) => !ehSolicitacao(d));
    const cad = cadastroDe(nome);
    return `<div class="vv-cli" data-vv-cli-cliente="${esc(cad?.nome || nome)}" data-vv-cli-id="${esc(cad?.id ?? '')}">
      ${blocoEspera(pecas, hoje)}${blocoSemana(conteudos, hoje)}${blocoCalendario(conteudos, hoje)}${blocoPlanejamentos(cad)}${blocoAcoes(cad)}</div>`;
  }

  function planejamentosHtml(planos) {
    if (!planos.length) return nota('Nenhum planejamento no painel ainda. Quando o agente do cliente publicar, aparece aqui.');
    const ordenados = [...planos].sort((a, b) => String(b.mes || '').localeCompare(String(a.mes || '')));
    return ordenados.slice(0, 3).map((p) => {
      const mes = typeof pljMes === 'function' ? pljMes(p.mes) : String(p.mes || '').slice(0, 7);
      const estado = (typeof PLJ_ESTADOS !== 'undefined' && PLJ_ESTADOS[p.estado]?.rotulo) || p.estado || 'Sem estado';
      const apoio = [p.titulo, p.versao ? `versão ${p.versao}` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="vv-cli-linha" data-vv-cli-plj-abrir="${esc(p.id)}"><span class="vv-cli-meio"><b>${esc(mes || 'Sem mês')}</b><small>${esc(apoio)}</small></span><em class="vv-cli-tag ${NIVEL_DO_PLANEJAMENTO[p.estado] || 'u5'}">${esc(estado)}</em></button>`;
    }).join('') + (ordenados.length > 3 ? nota(`e mais ${ordenados.length - 3} em Abrir o cliente`) : '');
  }
  // A consulta da ficha do cliente (GET, só leitura). Erro aparece como erro, não como lista vazia.
  async function carregarPlanejamentos(caixa) {
    if (caixa.dataset.vvCliCarregado) return;
    caixa.dataset.vvCliCarregado = '1';
    const id = caixa.dataset.vvCliPlj;
    if (!id || typeof pljPedir !== 'function') return;
    try {
      const d = await pljPedir(`cliente_id=${encodeURIComponent(id)}`);
      if (!caixa.isConnected) return;
      caixa.innerHTML = d?.disponivel ? planejamentosHtml(lista(d.planejamentos)) : nota('Os planejamentos ainda não foram ligados no banco.');
    } catch (erro) {
      if (caixa.isConnected) caixa.innerHTML = nota(`Não foi possível buscar os planejamentos: ${erro?.message || 'o painel não respondeu'}`, 'erro');
    }
  }

  function alternarDia(bloco, botao) {
    const iso = botao.dataset.vvCliDia, aberto = botao.getAttribute('aria-pressed') === 'true';
    bloco.querySelectorAll('[data-vv-cli-dia]').forEach((b) => b.setAttribute('aria-pressed', String(!aberto && b === botao)));
    bloco.querySelectorAll('[data-vv-cli-lista]').forEach((l) => { l.hidden = aberto || l.dataset.vvCliLista !== iso; });
    const dica = bloco.querySelector('[data-vv-cli-dica]');
    if (dica) dica.hidden = !aberto;
  }

  const ligados = new WeakSet();
  const depoisDe = new WeakMap();
  // Depois de desativar/apagar: quem chamou decide (ligar(raiz, { depois })); sem isso, recarrega o
  // cadastro (o cliente sai da cidade) e fecha a placa pelo próprio botão de fechar.
  async function depoisDoCiclo(raiz) {
    const proprio = depoisDe.get(raiz);
    if (typeof proprio === 'function') return proprio();
    if (typeof ensureClientMasterSources === 'function') { try { await ensureClientMasterSources(true); } catch { /* a placa fecha mesmo assim */ } }
    raiz.querySelector?.('[data-fechar]')?.click();
  }
  function aoClicar(e, raiz) {
    const alvo = e.target?.closest?.('[data-vv-cli-peca],[data-vv-cli-dia],[data-vv-cli-plj-abrir],[data-vv-cli-desativar],[data-vv-cli-apagar]');
    if (!alvo || (raiz.contains && !raiz.contains(alvo)) || alvo.disabled) return;
    const bloco = alvo.closest('.vv-cli');
    if (!bloco) return;
    if (alvo.dataset.vvCliPeca) { chamar('openItemWorkspace', String(alvo.dataset.vvCliPeca)); return; }
    if (alvo.dataset.vvCliDia) { alternarDia(bloco, alvo); return; }
    if (alvo.dataset.vvCliPljAbrir) { chamar('abrirPlanejamento', String(alvo.dataset.vvCliPljAbrir)); return; }
    // O servidor confere de novo; aqui só não abre a janela para quem não administra.
    const id = bloco.dataset.vvCliId, nome = bloco.dataset.vvCliCliente;
    if (!souAdminAqui() || !id || !nome) return;
    const fim = { depois: () => depoisDoCiclo(raiz) };
    if (alvo.hasAttribute('data-vv-cli-desativar')) chamar('abrirDesativarNoCiclo', 'cliente', id, nome, fim);
    else if (alvo.hasAttribute('data-vv-cli-apagar')) chamar('abrirApagarNoCiclo', 'cliente', id, nome, fim);
  }
  // Pode ser chamado a cada vez que a placa é redesenhada: o clique é ligado uma vez por raiz e os
  // planejamentos são buscados para os blocos novos.
  function ligar(raiz, { depois } = {}) {
    if (!raiz?.querySelectorAll) return Promise.resolve();
    if (typeof depois === 'function') depoisDe.set(raiz, depois); else depoisDe.delete(raiz);
    if (!ligados.has(raiz)) { ligados.add(raiz); raiz.addEventListener('click', (e) => aoClicar(e, raiz)); }
    return Promise.all([...raiz.querySelectorAll('[data-vv-cli-plj]')].map(carregarPlanejamentos));
  }

  G.VybeClientePlaca = Object.freeze({ html, ligar, ESPERA_DO_CLIENTE, META_SEMANA });
})();
