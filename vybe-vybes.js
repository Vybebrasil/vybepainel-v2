// VYBES no Vybe OS (decisão do Paulo, 02/11/2026: "os heads usam a interface como eu, sem link novo").
// O VYBES roda no PC do Paulo e publica aqui o mesmo dia que a central dele mostra (server/vybes.js).
// Paulo, Vinícius, Ewerton e Deivid veem tudo e agem — pelo mesmo executor das ações do assistente, em dois passos
// (preparar mostra o resumo; confirmar executa). O resto da equipe só vê, sem o texto das conversas.
const VYBES = { dados: null, carregando: false, erro: '', pendente: null, alteracao: null, timer: null, falando: false };
const VYBES_SITUACOES = [['saiu', 'pronta'], ['agendar', 'para agendar'], ['aprovacao', 'em aprovação'], ['cliente', 'no cliente'], ['fazer', 'sem fazer']];

// Entrada pela tela inicial (a faixa VYBES embaixo das estações).
function chooseVybesMode() {
  if (typeof closeTransientOverlaysForNavigation === 'function') closeTransientOverlaysForNavigation();
  if (typeof closeModeGate === 'function') closeModeGate();
  switchBoard('vybes', document.getElementById('btn-board-vybes'));
}

async function abrirVybes() {
  renderVybes();
  await carregarVybes();
  clearInterval(VYBES.timer);
  VYBES.timer = setInterval(() => { if (activeBoard === 'vybes' && !document.hidden && !VYBES.pendente) carregarVybes(true); }, 60000);
}

async function carregarVybes(silencioso = false) {
  if (VYBES.carregando) return;
  VYBES.carregando = true; if (!silencioso) { VYBES.erro = ''; renderVybes(); }
  try {
    const r = await fetch('/api/painel?area=vybes', { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Não foi possível ler o VYBES.');
    VYBES.dados = d; VYBES.erro = '';
  } catch (erro) { if (!silencioso || !VYBES.dados) VYBES.erro = erro.message || 'Não foi possível ler o VYBES.'; }
  finally { VYBES.carregando = false; renderVybes(); }
}

// Ações: preparar (o servidor confere a permissão e devolve o resumo) → confirmar (executa).
async function vybesPedir(corpo) {
  const r = await fetch('/api/painel?area=vybes', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Não foi possível concluir.');
  return d;
}
async function vybesPreparar(pedido, rotulo) {
  try {
    const d = await vybesPedir({ etapa: 'preparar', pedido });
    if (d.recusa) { showToast(d.recusa, 'error', 6000); return; }
    VYBES.pendente = { rotulo, resumo: d.resumo || rotulo, codigo: d.codigo }; VYBES.alteracao = null; renderVybes();
  } catch (erro) { showToast(erro.message, 'error', 6000); }
}
async function vybesConfirmar() {
  const p = VYBES.pendente; if (!p) return;
  VYBES.pendente = { ...p, enviando: true }; renderVybes();
  try { const d = await vybesPedir({ etapa: 'confirmar', codigo: p.codigo }); showToast(d.feito || 'Feito.', 'success', 5000); VYBES.pendente = null; carregarVybes(true); }
  catch (erro) { showToast(erro.message, 'error', 6000); VYBES.pendente = { ...p, enviando: false }; renderVybes(); }
}
function vybesCancelar() { VYBES.pendente = null; VYBES.alteracao = null; renderVybes(); }

function vybesAprovar(ref, nome) { vybesPreparar({ acao: 'status', item: ref, para: 'Para agendar' }, `Aprovar ${nome}`); }
function vybesPassar(ref, para, nome) { vybesPreparar({ acao: 'responsavel', item: ref, para }, `Passar ${nome} para ${para}`); }
function vybesAbrirAlteracao(ref) { VYBES.alteracao = ref; renderVybes(); setTimeout(() => document.getElementById('vybes-alteracao-texto')?.focus(), 30); }
function vybesPedirAlteracao(ref, nome) {
  const texto = String(document.getElementById('vybes-alteracao-texto')?.value || '').trim();
  if (texto.length < 3) { showToast('Escreva o que mudar.', 'info', 3000); return; }
  vybesPreparar({ acao: 'alteracao', item: ref, texto }, `Pedir alteração em ${nome}`);
}
function vybesMarcarEncaixe(i) { const e = VYBES.dados?.estado?.gravacoes?.encaixes?.[i]; if (e) vybesPreparar({ acao: 'agendar_captacao', encaixe: e.codigo }, `Marcar a gravação: ${e.quem}`); }
function vybesCriarIdeia(i) { const x = VYBES.dados?.estado?.noite?.ideias?.[i]; if (x?.pedido) vybesPreparar(x.pedido, `Criar ${x.formato} “${x.titulo}” para ${x.cliente}`); }

// Abre a peça como o painel abre: a prévia grande (card, carrossel ou vídeo) e, pelo link, a atividade.
function vybesVerPeca(ref, refs) {
  if (!ref || typeof abrirPecaNaPrevia !== 'function') return;
  const ids = (refs || [ref]).filter(Boolean);
  abrirPecaNaPrevia(ref, { ids, rotulo: 'VYBES', indice: Math.max(0, ids.indexOf(ref)) });
}
function vybesAbrirAtividade(ref) {
  if (!ref) return;
  const ehPedido = (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []).some((d) => String(d.id) === String(ref));
  const abrir = ehPedido ? window.openDemandaWorkspace : window.openItemWorkspace;
  if (typeof abrir === 'function') abrir(String(ref));
}

// Ouvir o bom dia: a voz do navegador (no Edge, a voz natural da Microsoft), ato por ato.
function vybesOuvir() {
  const s = window.speechSynthesis; if (!s) { showToast('Este navegador não fala.', 'info', 3000); return; }
  if (VYBES.falando) { s.cancel(); VYBES.falando = false; renderVybes(); return; }
  const textos = (VYBES.dados?.estado?.jornada || []).map((x) => x.texto).filter(Boolean);
  if (!textos.length) return;
  const vozes = s.getVoices(), voz = vozes.find((v) => /pt-BR/i.test(v.lang) && /natural|online/i.test(v.name)) || vozes.find((v) => /pt-BR/i.test(v.lang));
  s.cancel(); VYBES.falando = true; renderVybes();
  textos.forEach((t, i) => {
    const u = new SpeechSynthesisUtterance(String(t).replace(/\bVybes?\b/g, (m) => m.endsWith('s') ? 'Vaibes' : 'Vaibe'));
    u.lang = 'pt-BR'; if (voz) u.voice = voz; u.rate = 1.05;
    if (i === textos.length - 1) u.onend = () => { VYBES.falando = false; renderVybes(); };
    s.speak(u);
  });
}

const vybesHora = (v) => { const t = Date.parse(v || ''); return Number.isFinite(t) ? new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }) : ''; };
const vybesPecaNome = (t) => String(t || '').replace(/^(\w+)\s+-\s+/, '$1 · ');
function vybesBotao(texto, onclick, forte = false) { return `<button type="button" class="vb-botao${forte ? ' principal' : ''}" onclick="${onclick}">${safeText(texto)}</button>`; }
const vybesArg = (v) => safeText(JSON.stringify(String(v ?? '')));

function vybesAgoraHtml(e) {
  const ps = e.prioridades || [];
  if (!ps.length) return vbEstadoHtml({ tipo: 'vazio', titulo: 'Nada urgente agora', texto: 'Hoje e amanhã em dia, ninguém esperando resposta.' });
  return ps.slice(0, 4).map((p, i) => {
    const grupos = [...(p.itens || []).reduce((m, x) => m.set(x.grupo || x.cliente || '', (m.get(x.grupo || x.cliente || '') || 0) + 1), new Map())].filter(([g]) => g);
    const refs = (p.itens || []).map((x) => x.ref).filter(Boolean);
    return `<article class="vybes-cartao ${p.nivel === 'critico' ? 'critico' : p.nivel === 'atencao' ? 'atencao' : ''}">
      <span class="vybes-num">${i + 1}</span>
      <div><h3>${safeText(p.titulo)}</h3>${p.fato ? `<p>${safeText(p.fato)}</p>` : ''}
        ${grupos.length ? `<div class="vybes-chips">${grupos.slice(0, 5).map(([g, n]) => `<span class="vb-chip"><b>${safeText(g)}</b> ${n}</span>`).join('')}</div>` : ''}
        ${p.sugestao ? `<p class="vybes-sugestao">${safeText(p.sugestao)}</p>` : ''}
        ${refs.length ? `<div class="vybes-acoes">${vybesBotao('Ver as peças', `vybesVerPeca(${vybesArg(refs[0])}, ${safeText(JSON.stringify(refs))})`)}</div>` : ''}</div></article>`;
  }).join('');
}

function vybesDecisoesHtml(e, pode) {
  const ds = e.decisoes || [];
  if (!ds.length) return vbEstadoHtml({ tipo: 'vazio', titulo: 'Nenhuma decisão esperando', texto: 'Nada em Para aprovação nem atribuição fora do padrão.' });
  const refs = ds.map((d) => d.ref).filter(Boolean);
  return ds.map((d) => {
    const nome = vybesPecaNome(d.titulo), arg = vybesArg(nome), ref = vybesArg(d.ref);
    const acoes = !pode ? '' : d.tipo === 'responsavel'
      ? vybesBotao(`Passar para ${d.para}`, `vybesPassar(${ref}, ${vybesArg(d.para)}, ${arg})`, true)
      : vybesBotao('Aprovar', `vybesAprovar(${ref}, ${arg})`, true) + vybesBotao('Pedir alteração', `vybesAbrirAlteracao(${ref})`);
    const alteracao = pode && VYBES.alteracao === d.ref ? `<div class="vybes-alteracao"><label for="vybes-alteracao-texto">O que mudar</label>
      <input id="vybes-alteracao-texto" type="text" maxlength="600" placeholder="Ex.: trocar a trilha e encurtar o começo" onkeydown="if(event.key==='Enter')vybesPedirAlteracao(${ref}, ${arg})">
      ${vybesBotao('Preparar', `vybesPedirAlteracao(${ref}, ${arg})`, true)}${vybesBotao('Cancelar', 'vybesCancelar()')}</div>` : '';
    return `<article class="vybes-decisao">
      <div class="vybes-decisao-topo"><span class="vybes-etiqueta">${d.tipo === 'responsavel' ? 'Quem faz' : 'Aprovar'}</span>${d.horas != null ? `<small>esperando há ${d.horas < 24 ? d.horas + ' h' : Math.round(d.horas / 24) + ' d'}</small>` : ''}</div>
      <h3>${safeText(nome)}</h3><p>${safeText([d.cliente, d.tipo === 'responsavel' ? `com ${d.quem}; costuma ser do ${d.para}` : d.quem].filter(Boolean).join(' · '))}</p>
      <div class="vybes-acoes">${vybesBotao('Ver a peça', `vybesVerPeca(${ref}, ${safeText(JSON.stringify(refs))})`)}${acoes}</div>${alteracao}</article>`;
  }).join('');
}

function vybesDiaHtml(e) {
  const d = e.dia, linhas = (d?.contagem || []).map((x) => {
    const total = Object.values(x.situacoes || {}).reduce((s, n) => s + n, 0);
    const barra = VYBES_SITUACOES.filter(([k]) => x.situacoes?.[k]).map(([k]) => `<i class="vybes-sit-${k}" style="flex:${x.situacoes[k]}"></i>`).join('');
    const txt = VYBES_SITUACOES.filter(([k]) => k !== 'saiu' && x.situacoes?.[k]).map(([k, r]) => `${x.situacoes[k]} ${r}`).join(' · ') || (total ? 'tudo pronto' : 'nada com data do cliente');
    return `<div class="vybes-dia-linha"><span class="vybes-dia-rotulo">${safeText(x.rotulo)}<b>${total}</b></span><span class="vybes-barra">${barra}</span><span class="vybes-dia-texto">${safeText(txt)}</span></div>`;
  }).join('');
  const ag = (e.agenda || []).filter((c) => !c.terminou);
  const agenda = ag.length ? ag.slice(0, 4).map((c) => `<li><b>${safeText(vybesHora(c.inicio))}</b> ${safeText(c.titulo)}${c.cliente ? ` · ${safeText(c.cliente)}` : ''}</li>`).join('') : '<li class="vybes-discreto">Agenda livre pelo resto do dia.</li>';
  const g = e.gravacoes, pode = VYBES.dados?.podeAgir;
  const grav = g ? `<p class="vybes-discreto">${g.total ? `${g.total} ${g.total === 1 ? 'peça espera' : 'peças esperam'} gravação.` : ''}</p>${(g.encaixes || []).slice(0, 3).map((x, i) => `<div class="vybes-encaixe"><span><b>Encaixe ${x.n}</b> ${safeText(x.quando)} · ${safeText(x.quem)}</span>${pode ? vybesBotao('Marcar', `vybesMarcarEncaixe(${i})`) : ''}</div>`).join('')}` : '';
  const s = e.solicitacoes;
  const sol = s ? `<div class="vybes-sol ${s.atrasadas?.length ? 'critico' : ''}"><b>${s.total}</b> abertas${s.atrasadas?.length ? ` · ${s.atrasadas.length} atrasadas` : ''}${s.hoje?.length ? ` · ${s.hoje.length} vencem hoje` : ''}${s.amanha ? ` · ${s.amanha} amanhã` : ''}</div>
    ${(s.atrasadas || []).slice(0, 4).map((x) => `<button type="button" class="vybes-linha" onclick="vybesAbrirAtividade(${vybesArg(x.ref)})"><span>${safeText(vybesPecaNome(x.titulo))}</span><small>${safeText([x.cliente, x.quem || 'sem responsável', x.dias != null ? `${-x.dias} d atrás` : ''].filter(Boolean).join(' · '))}</small></button>`).join('')}` : '';
  return `<section class="vybes-bloco"><h3>Conteúdo</h3>${linhas || '<p class="vybes-discreto">Ainda sem a leitura da semana.</p>'}</section>
    <section class="vybes-bloco"><h3>Agenda</h3><ul class="vybes-agenda">${agenda}</ul>${grav}</section>
    ${sol ? `<section class="vybes-bloco"><h3>Solicitações</h3>${sol}</section>` : ''}`;
}

function vybesWhatsappHtml(e, pode) {
  const w = e.whatsapp;
  if (!w) return '<p class="vybes-discreto">Ainda sem a leitura dos grupos.</p>';
  const esp = (w.esperando || []).filter((x) => x.minutos >= 30).sort((a, b) => b.minutos - a.minutos);
  const dur = (m) => m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`;
  return `${esp.length ? esp.slice(0, 4).map((x) => `<div class="vybes-espera"><span><b>${safeText(x.cliente)}</b><em>${safeText(dur(x.minutos))} sem resposta</em></span>${pode && x.texto ? `<p>“${safeText(x.texto)}”</p>` : ''}</div>`).join('') : '<p class="vybes-discreto">Ninguém esperando resposta.</p>'}
    ${w.quietos ? `<p class="vybes-discreto">${w.quietos} ${w.quietos === 1 ? 'grupo' : 'grupos'} em silêncio desde ontem.</p>` : ''}
    ${w.internos ? `<p class="vybes-time${w.internos.alertas?.length ? ' atencao' : ''}">Time: ${w.internos.alertas?.length && pode ? `${safeText(w.internos.alertas[0].autor)} em ${safeText(w.internos.alertas[0].grupo)}: “${safeText(w.internos.alertas[0].texto)}”` : `${w.internos.n} mensagens${w.internos.grupos?.length ? ', mais em ' + safeText(w.internos.grupos.slice(0, 2).join(' e ')) : ''}`}</p>` : ''}`;
}

function vybesNoiteHtml(e, pode) {
  const n = e.noite; if (!n) return '';
  const ideias = (n.ideias || []).map((x, i) => `<div class="vybes-ideia"><div><b>${safeText(x.formato)} · ${safeText(x.titulo)}</b><small>${safeText([x.cliente, x.veicula ? 'veicula ' + x.veicula.slice(8, 10) + '/' + x.veicula.slice(5, 7) : ''].filter(Boolean).join(' · '))}</small><p>${safeText(x.porque || '')}</p></div>${pode ? vybesBotao('Criar o card', `vybesCriarIdeia(${i})`, true) : ''}</div>`).join('');
  const apr = (n.aprendizados || []).map((x) => `<li><b>${safeText(x.cliente)}</b>: ${safeText(x.texto)}</li>`).join('');
  const opo = (n.oportunidades || []).map((x) => `<li><b>${safeText(x.cliente)}</b>: ${safeText(x.texto)}</li>`).join('');
  return `<section class="vybes-coluna-bloco"><h2>Esta noite</h2><p class="vybes-discreto">Estudei ${n.estudados || 0} ${n.estudados === 1 ? 'cliente' : 'clientes'}.</p>${ideias}
    ${apr ? `<h3>Aprendi</h3><ul class="vybes-lista">${apr}</ul>` : ''}${opo ? `<h3>Oportunidades</h3><ul class="vybes-lista">${opo}</ul>` : ''}</section>`;
}

function renderVybes() {
  const el = document.getElementById('painel-vybes'); if (!el) return;
  const d = VYBES.dados, e = d?.estado;
  if (!d && VYBES.carregando) { el.innerHTML = vbCabecalhoHtml({ titulo: 'VYBES', texto: 'O dia da agência como a central do Paulo vê.' }) + vbEstadoHtml({ tipo: 'carregando', titulo: 'Lendo o VYBES' }); return; }
  if (VYBES.erro && !e) { el.innerHTML = vbCabecalhoHtml({ titulo: 'VYBES' }) + vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível ler o VYBES', texto: VYBES.erro, acao: '<button type="button" class="vb-botao" onclick="carregarVybes()">Tentar de novo</button>' }); return; }
  if (!e) { el.innerHTML = vbCabecalhoHtml({ titulo: 'VYBES' }) + vbEstadoHtml({ tipo: 'vazio', titulo: 'O VYBES ainda não publicou', texto: 'Assim que a central do PC do Paulo estiver ligada, o dia aparece aqui.' }); return; }
  const pode = Boolean(d.podeAgir);
  const idadeMin = d.atualizadoEm ? Math.round((Date.now() - Date.parse(d.atualizadoEm)) / 60000) : null;
  const velho = idadeMin != null && idadeMin > 10 ? `<p class="vybes-aviso" role="status">A central do PC do Paulo não publica desde ${safeText(vybesHora(d.atualizadoEm))} (PC desligado ou sem internet). O que está aqui pode estar atrasado.</p>` : '';
  const pend = VYBES.pendente ? `<div class="vybes-confirmar" role="dialog" aria-label="Confirmar ação"><div><b>Confirmar?</b><p>${safeText(VYBES.pendente.resumo).replace(/\n/g, '<br>')}</p></div>
    <div class="vybes-acoes">${VYBES.pendente.enviando ? '<span class="vybes-discreto">Fazendo…</span>' : vybesBotao('Sim, fazer', 'vybesConfirmar()', true) + vybesBotao('Cancelar', 'vybesCancelar()')}</div></div>` : '';
  const ws = e.whatsapp, esperando = (ws?.esperando || []).filter((x) => x.minutos >= 30).length;
  el.innerHTML = vbCabecalhoHtml({ titulo: 'VYBES', texto: e.estadoDia?.frase || 'O dia da agência como a central do Paulo vê.',
      acoes: vybesBotao(VYBES.falando ? 'Parar' : 'Ouvir o bom dia', 'vybesOuvir()') + vybesBotao('Atualizar', 'carregarVybes()') })
    + velho + pend
    + vbResumoHtml([{ valor: (e.prioridades || []).length, rotulo: ' pedem atenção', tom: (e.prioridades || []).some((p) => p.nivel === 'critico') ? 'alerta' : '' },
      { valor: (e.decisoes || []).length, rotulo: ' decisões', tom: (e.decisoes || []).length ? 'atencao' : '' },
      { valor: e.solicitacoes?.atrasadas?.length || 0, rotulo: ' solicitações atrasadas', tom: e.solicitacoes?.atrasadas?.length ? 'alerta' : '' },
      { valor: esperando, rotulo: ' clientes esperando', tom: esperando ? 'alerta' : '' }])
    + `<div class="vybes-grade">
      <div class="vybes-coluna"><section class="vybes-coluna-bloco"><h2>Agora</h2>${vybesAgoraHtml(e)}</section></div>
      <div class="vybes-coluna"><section class="vybes-coluna-bloco"><h2>Decisões</h2>${vybesDecisoesHtml(e, pode)}</section>${vybesNoiteHtml(e, pode)}</div>
      <div class="vybes-coluna"><section class="vybes-coluna-bloco"><h2>O dia</h2>${vybesDiaHtml(e)}</section><section class="vybes-coluna-bloco"><h2>WhatsApp</h2>${vybesWhatsappHtml(e, pode)}</section></div>
    </div>
    <details class="vybes-jornada"><summary>O bom dia, ato por ato</summary><ol>${(e.jornada || []).map((s) => `<li>${safeText(s.texto)}</li>`).join('')}</ol></details>
    <p class="vybes-rodape">${pode ? 'Você pode agir pelo VYBES: cada ação mostra o resumo e só acontece no “Sim, fazer”.' : 'Você vê o VYBES. As ações aqui são de Paulo, Vinícius, Ewerton e Deivid.'} Lido às ${safeText(vybesHora(d.atualizadoEm))}.</p>`;
}
