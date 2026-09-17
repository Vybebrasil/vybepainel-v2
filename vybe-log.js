// vybe-log.js — o Log de atividade da peça, como o do Monday.
//
// A gaveta mostrava o tempo em cada status e os comentários; a trajetória
// inteira — quem mudou o prazo, quem trocou o responsável, o que a automação fez
// — estava gravada no banco e não tinha tela. O botão "Log de atividade" abre
// essa trajetória dentro da própria gaveta, do mais recente para o mais antigo,
// separada por dia e na hora da Bahia.
//
// A frase de cada evento mora numa função sem tela (fraseDoLog), para o teste
// poder conferir o texto de cada tipo sem montar a gaveta.

const LOG_FUSO = 'America/Bahia';
const LOG_FILTROS = [
  ['tudo', 'Tudo'], ['status', 'Status'], ['datas', 'Datas'],
  ['pessoas', 'Pessoas'], ['arquivos', 'Arquivos'], ['comentarios', 'Comentários'],
];
const LOG_CAMPOS = {
  captacao: 'a captação', formato: 'o formato', tipo_conteudo: 'o tipo de conteúdo',
  off_audio: 'o OFF / áudio', prioridade: 'a prioridade',
};
let LOG_ABERTO = null; // { itemId, itens, importada, filtro, demanda }

function logDataBr(valor) {
  const v = String(valor || '');
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// { categoria, frase } — a frase já vem com o HTML escapado; só o <b> é nosso.
function fraseDoLog(ev = {}, { demanda = false } = {}) {
  const b = (v) => `<b>${safeText(v)}</b>`;
  // Status aparece como a etiqueta dele, com a cor do catálogo — é assim que o
  // time reconhece a etapa no resto do painel.
  const etiqueta = (v) => (demanda && typeof pillHtmlDemanda === 'function' ? pillHtmlDemanda : pillHtml)(safeText(v));
  const troca = (oque, de, para, fmt = (x) => x) => {
    if (de && para) return `mudou ${oque} de ${b(fmt(de))} para ${b(fmt(para))}`;
    if (para) return `definiu ${oque} como ${b(fmt(para))}`;
    if (de) return `tirou ${oque} (era ${b(fmt(de))})`;
    return `mudou ${oque}`;
  };
  const { tipo, de, para, texto } = ev;
  switch (tipo) {
    case 'criacao': return { categoria: 'tudo', frase: 'criou a peça' };
    case 'status': {
      if (typeof pillHtml !== 'function') return { categoria: 'status', frase: troca('o status', de, para) };
      const frase = de && para ? `mudou o status de ${etiqueta(de)} para ${etiqueta(para)}`
        : para ? `definiu o status como ${etiqueta(para)}` : de ? `tirou o status (era ${etiqueta(de)})` : 'mudou o status';
      return { categoria: 'status', frase };
    }
    case 'prazo': return { categoria: 'datas', frase: troca('o prazo', de, para, logDataBr) };
    case 'veiculacao':
      return { categoria: 'datas', frase: troca(demanda ? 'a conclusão' : 'a veiculação', de, para, logDataBr) };
    case 'grupo': return { categoria: 'tudo', frase: troca('o grupo', de, para) };
    case 'titulo': return { categoria: 'tudo', frase: `renomeou de ${b(de || '—')} para ${b(para || '—')}` };
    case 'board': return { categoria: 'tudo', frase: `moveu de ${b(de || '—')} para ${b(para || '—')}` };
    case 'responsavel': return { categoria: 'pessoas', frase: troca('os responsáveis', de, para) };
    case 'clientes': return { categoria: 'tudo', frase: troca('os clientes', de, para) };
    case 'material_bruto':
      return { categoria: 'arquivos', frase: para ? (de ? 'trocou o link do material bruto' : 'registrou o link do material bruto')
        : 'removeu o link do material bruto' };
    case 'anexo': return { categoria: 'arquivos', frase: `enviou o arquivo ${b(para || '')}` };
    case 'anexo_removido': return { categoria: 'arquivos', frase: `removeu o arquivo ${b(de || '')}` };
    case 'comentario':
      return { categoria: 'comentarios', frase: `${ev.do_monday ? 'comentou no Monday' : 'comentou'}: “${safeText(texto || '')}”` };
    case 'comentario_editado': return { categoria: 'comentarios', frase: `editou um comentário: “${safeText(texto || '')}”` };
    case 'comentario_apagado': return { categoria: 'comentarios', frase: `apagou um comentário: “${safeText(texto || '')}”` };
    case 'subitem_criado': return { categoria: 'tudo', frase: `criou a tarefa ${b(para || '')}` };
    case 'subitem_removido': return { categoria: 'tudo', frase: `removeu a tarefa ${b(de || '')}` };
    case 'subitem_status': return { categoria: 'status', frase: `mudou a tarefa ${b(texto || '')} de ${b(de || '—')} para ${b(para || '—')}` };
    case 'remocao': return { categoria: 'tudo', frase: `removeu a peça${para ? ` — motivo: “${safeText(para)}”` : ''}` };
    case 'restauracao': return { categoria: 'tudo', frase: 'restaurou a peça' };
    case 'briefing':
      return { categoria: 'tudo', frase: para ? (de ? 'editou o briefing' : 'adicionou o briefing') : 'apagou o briefing' };
    case 'automacao':
      return { categoria: 'tudo', frase: `aplicou a regra ${b(texto || '')}${para ? `: ${safeText(para)}` : ''}` };
    default:
      if (LOG_CAMPOS[tipo]) return { categoria: 'tudo', frase: troca(LOG_CAMPOS[tipo], de, para) };
      return { categoria: 'tudo', frase: `alterou ${safeText(tipo || 'a peça')}` };
  }
}

// Quem aparece na linha. Sem pessoa gravada, a linha diz de onde veio em vez de
// ficar sem sujeito.
function autorDoLog(ev = {}) {
  if (ev.tipo === 'automacao') return 'Automação';
  if (ev.autor) return ev.autor;
  if (ev.tipo === 'criacao' && ev.texto) return ev.texto;
  return ev.do_monday ? 'Monday' : 'Sistema';
}

// A bolinha de quem fez: a foto da equipe (a mesma do resto do painel), ou as
// iniciais. Quem não é pessoa — automação, Monday, sistema — ganha um símbolo
// próprio, para não parecer alguém da equipe sem foto. O nome fica no title e
// no texto para leitor de tela.
function rostoDoLogHtml(ev = {}) {
  const nome = autorDoLog(ev);
  const pessoa = ev.autor_ref && typeof TEAM_USERS !== 'undefined'
    ? TEAM_USERS.find((u) => String(u.id) === String(ev.autor_ref)) : null;
  const titulo = `title="${safeText(nome)}" aria-label="${safeText(nome)}"`;
  if (!ev.autor && ev.tipo === 'automacao') {
    return `<span class="log-rosto log-rosto-sistema automacao" ${titulo}><svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M9.2 1 3 9h4.3L6.6 15 13 7H8.6z"/></svg></span>`;
  }
  if (!ev.autor && !(ev.tipo === 'criacao' && ev.texto)) {
    return `<span class="log-rosto log-rosto-sistema" ${titulo}>${ev.do_monday ? 'M' : 'S'}</span>`;
  }
  const foto = pessoa?.photo || ev.autor_foto || '';
  const iniciais = safeText(String(nome).trim().split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?');
  const cor = pessoa?.color || '#5b5f6b';
  return foto
    ? `<span class="log-rosto" ${titulo}><img src="${safeText(foto)}" alt="" onerror="this.parentNode.style.background='${cor}';this.outerHTML='<b>${iniciais}</b>'"></span>`
    : `<span class="log-rosto" style="background:${cor}" ${titulo}><b>${iniciais}</b></span>`;
}

function logDiaNaBahia(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: LOG_FUSO });
}
function logRotuloDoDia(dia, agora = Date.now()) {
  const hoje = logDiaNaBahia(agora);
  const ontem = logDiaNaBahia(agora - 86400000);
  if (dia === hoje) return 'Hoje';
  if (dia === ontem) return 'Ontem';
  return logDataBr(dia);
}

function botaoDoLogHtml(itemId, { demanda = false } = {}) {
  return `<button type="button" class="vybe-link log-botao"
    onclick="event.stopPropagation();abrirLogDaPeca('${safeText(itemId)}',{demanda:${demanda}})"
    title="Quem fez o quê nesta peça, com dia e hora"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg><span>Log de atividade</span></button>`;
}

async function abrirLogDaPeca(itemId, { demanda = false } = {}) {
  const gaveta = document.getElementById('workspace-drawer');
  if (!gaveta) return;
  fecharLogDaPeca();
  const painel = document.createElement('section');
  painel.id = 'log-atividade';
  painel.className = 'log-atividade';
  painel.setAttribute('role', 'region');
  painel.setAttribute('aria-label', 'Log de atividade');
  painel.innerHTML = `${logTopoHtml()}<div class="log-corpo"><div class="workspace-loading">Carregando o log…</div></div>`;
  gaveta.append(painel);
  LOG_ABERTO = { itemId: String(itemId), itens: [], importada: false, filtro: 'tudo', demanda };
  try {
    const r = await fetch(`/api/painel?area=peca&log=1&item=${encodeURIComponent(itemId)}`,
      { credentials: 'same-origin', cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d?.ok) throw new Error(d?.error || `Log indisponível (${r.status})`);
    if (!LOG_ABERTO || LOG_ABERTO.itemId !== String(itemId)) return;
    Object.assign(LOG_ABERTO, { itens: d.itens || [], importada: Boolean(d.importada), limite: d.limite || 0 });
    pintarLogDaPeca();
  } catch (e) {
    const corpo = painel.querySelector('.log-corpo');
    if (corpo) corpo.innerHTML = `<div class="workspace-empty">Não foi possível carregar o log. ${safeText(e.message)}
      <button type="button" class="workspace-action" onclick="abrirLogDaPeca('${safeText(itemId)}',{demanda:${demanda}})">Tentar de novo</button></div>`;
  }
  painel.querySelector('.log-voltar')?.focus();
}

function fecharLogDaPeca() {
  const painel = document.getElementById('log-atividade');
  LOG_ABERTO = null;
  if (!painel) return false;
  painel.remove();
  return true;
}

function filtrarLogDaPeca(filtro) {
  if (!LOG_ABERTO) return;
  LOG_ABERTO.filtro = filtro;
  pintarLogDaPeca();
}

function logTopoHtml() {
  const filtro = LOG_ABERTO?.filtro || 'tudo';
  return `<div class="log-topo">
      <button type="button" class="log-voltar" onclick="fecharLogDaPeca()" aria-label="Voltar para a peça">‹ Voltar</button>
      <b>Log de atividade</b>
      <button class="workspace-close" type="button" onclick="closeItemWorkspace()" aria-label="Fechar">×</button>
    </div>
    <div class="log-filtros" role="group" aria-label="Filtrar o log">${LOG_FILTROS.map(([chave, rotulo]) =>
      `<button type="button" class="${filtro === chave ? 'ativo' : ''}" aria-pressed="${filtro === chave}"
        onclick="filtrarLogDaPeca('${chave}')">${rotulo}</button>`).join('')}</div>`;
}

function pintarLogDaPeca() {
  const painel = document.getElementById('log-atividade');
  if (!painel || !LOG_ABERTO) return;
  const { itens, filtro, importada, demanda, limite } = LOG_ABERTO;
  const linhas = itens.map((ev) => ({ ev, ...fraseDoLog(ev, { demanda }) }))
    .filter((l) => filtro === 'tudo' || l.categoria === filtro);
  const porDia = new Map();
  for (const l of linhas) {
    const dia = logDiaNaBahia(l.ev.em);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(l);
  }
  const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: LOG_FUSO, hour: '2-digit', minute: '2-digit' });
  const blocos = [...porDia.entries()].map(([dia, doDia]) => `<div class="log-dia">
      <div class="log-dia-rotulo">${safeText(logRotuloDoDia(dia))}</div>
      ${doDia.map(({ ev, frase }) => `<div class="log-linha log-${safeText(ev.tipo)}">
        ${rostoDoLogHtml(ev)}
        <span class="log-oque">${frase}</span>
        <time class="log-hora" datetime="${safeText(ev.em)}">${hora(ev.em)}</time>
      </div>`).join('')}
    </div>`).join('');
  const vazio = itens.length
    ? '<div class="workspace-empty">Nada deste tipo registrado nesta peça.</div>'
    : '<div class="workspace-empty">Nenhuma atividade registrada nesta peça ainda.</div>';
  const cortado = limite && itens.filter((i) => i.tipo !== 'automacao' && !(i.tipo === 'comentario' && i.do_monday)).length >= limite
    ? `<p class="log-nota">Mostrando as ${limite} mudanças mais recentes.</p>` : '';
  const nota = importada
    ? '<p class="log-nota">Esta peça veio do Monday: de antes da importação, só o histórico de status e os comentários vieram junto.</p>'
    : '';
  painel.innerHTML = `${logTopoHtml()}<div class="log-corpo">${blocos || vazio}${cortado}${nota}</div>`;
}
