// vybe-portoes.js — o que o painel pergunta antes de deixar a peça seguir.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes.
//
// Um assunto só, apesar do tamanho: quais status exigem conferência, qual
// conferência cada um exige, a caixa que faz a pergunta e o registro do que foi
// respondido. O checklist de qualidade, a conferência do material, a conferência
// visual da arte e a passagem de bastão são quatro perguntas com a mesma forma —
// e é por isso que dividem a mesma caixa.
//
// Carrega DEPOIS de vybe-risco.js: lê HOJE_ISO, DADOS, findOperationalItem e
// chama commitStatusChange e updateLocalStatus, declarados lá.

const HANDOFF_TARGET_STATUSES = new Set(['ag. aprovação cliente']);
// 'para agendar' saiu daqui: entrar nesse status e dizer "a peca esta pronta,
// falta marcar a hora" — nao e a entrega em si, e o checklist de qualidade antes
// dele virava pedagio. 'agendado' fica, mas na pratica quem manda nele e a
// revisao de material, que roda antes desta.
const QUALITY_TARGET_STATUSES = new Set(['agendado']);
const MATERIAL_REVIEW_TARGET_STATUSES = new Set(['agendado','finalizado','feito']);
// Status que nao pedem justificativa escrita para entrar.
//
// 'Pode Fazer' e o mais comum de todos: e o que significa "o briefing esta de pe,
// pode comecar". Nao e uma volta nem um bloqueio — nao ha o que justificar, e
// obrigar a escrever um motivo em cada peca liberada era um pedagio na parte
// mais repetida do dia.
//
// 'Finalizado' entra pelo mesmo motivo: ali a trava que importa e a conferencia
// visual do material, nao o texto.
// 'para agendar' precisa entrar AQUI junto com a saida do checklist. Sem isso, o
// portao nao some — troca de nome: statusNeedsContext e "nao esta livre e nenhum
// outro portao pegou", entao tirar de um so empurra a peca para o outro.
const CONTEXT_FREE_STATUSES = new Set(['em andamento','em execução','em execucao',
  'finalizado','feito','pode fazer','a fazer','para agendar',
  // Captação agendada e espera simples seguem direto, sem formulário obrigatório.
  'cap. agendada','aguardo',
  // Esperar o texto ou o audio chegar nao e uma decisao a justificar: nada foi
  // decidido, so ainda nao chegou. Pedir motivo aqui e pedagio.
  'aguardo redação','aguardo redacao','falta off']);
// Mandar para aprovacao nao e prestar contas — e mostrar o que ficou pronto.
//
// O portao antigo pedia motivo escrito, proxima pessoa e link de referencia
// antes de deixar a peca entrar em "Aguardando Aprovacao". Isso faz sentido
// quando a mudanca precisa de justificativa (uma volta, um bloqueio); aqui nao:
// quem terminou quer olhar a arte uma ultima vez e mandar. O texto obrigatorio
// virava um pedagio, e pedagio na hora de entregar e o jeito mais rapido de o
// time parar de usar o painel.
//
// Entao estas passam a abrir a arte no centro da tela, com voltar e confirmar —
// e nada mais.
const CONFERENCIA_VISUAL_STATUSES = new Set([
  'para aprovação', 'para aprovacao',
  // Os dois nomes antigos ficam ate a juncao ser feita em todos os ambientes.
  'aguardando aprovação', 'aguardando aprovacao',
  'em aprovação', 'em aprovacao',
]);
function statusNeedsConferenciaVisual(option) {
  return Boolean(option) && CONFERENCIA_VISUAL_STATUSES.has(normalizedWorkflowStatus(option.label));
}
let pendingWorkflowChange = null;
function normalizedWorkflowStatus(status='') { return String(status).trim().toLowerCase(); }
function statusNeedsHandoff(item, option) { return item && option && HANDOFF_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && normalizedWorkflowStatus(item.status) !== normalizedWorkflowStatus(option.label); }
// FINALIZADO NO MEIO DA ESTEIRA NAO E ENTREGA.
//
// A conferencia final pergunta se o material foi entregue ou publicado e se o
// destino final confere. Em Producao e em Redacao isso nao existe: quem captou a
// foto nao publicou nada, quem escreveu o roteiro tambem nao. "Finalizado" ali
// quer dizer "a minha etapa acabou, segue" — e o proprio motor de automacoes ja
// trata assim, movendo a peca para a etapa seguinte.
//
// O portao pedia conferencia de uma entrega que ainda nem existe. Tres caixas
// que so podem ser marcadas no automatico sao o pior estado possivel para uma
// trava: ensinam a clicar sem ler, e no dia em que a conferencia importa de
// verdade — no fim da esteira — ela ja virou reflexo.
const GRUPOS_SEM_CONFERENCIA_FINAL = new Set(['novo_grupo57911__1', 'group_title']);
// O id do grupo tem tres nomes diferentes no painel conforme quem montou o item:
// 'group_id' no processItemsAll, 'grupo_id' na gaveta e no banco. Ate isso ser
// unificado, ler os dois e a unica leitura que funciona nos dois caminhos.
const grupoDaPeca = (item) => String(item?.group_id || item?.grupo_id || '');
function conferenciaFinalDispensada(item, option) {
  const alvo = normalizedWorkflowStatus(option?.label);
  if (alvo !== 'finalizado' && alvo !== 'feito') return false;
  return GRUPOS_SEM_CONFERENCIA_FINAL.has(grupoDaPeca(item));
}
// A pergunta que os portoes fazem passa a considerar ONDE a peca esta, e nao so
// para onde ela vai.
function precisaDeConferenciaFinal(item, option) {
  return statusNeedsMaterialReview(option) && !conferenciaFinalDispensada(item, option);
}
function statusNeedsMaterialReview(option) { return option && MATERIAL_REVIEW_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)); }
function statusNeedsQuality(option) { return option && QUALITY_TARGET_STATUSES.has(normalizedWorkflowStatus(option.label)) && !statusNeedsMaterialReview(option); }
function statusNeedsContext(option) {
  const status = normalizedWorkflowStatus(option?.label);
  // Finalizado não exige justificativa: a única trava é a conferência visual do material.
  return Boolean(status) && !CONTEXT_FREE_STATUSES.has(status) && !statusNeedsQuality(option)
    && !statusNeedsMaterialReview(option) && !statusNeedsConferenciaVisual(option);
}
// A peça no alto de toda janela de troca de status, como na direção de arte:
// ícone do formato, cliente e formato em cima, o nome embaixo e, à direita, o
// status de agora → o de destino em duas pílulas. `target` que não é status
// ("sinalizar bloqueio") aparece só como a pílula de destino.
function workflowItemHtml(item, target='') {
  const formato = String(item.formato || '').trim();
  const de = item.status ? (typeof pillHtml === 'function' ? pillHtml(item.status, item.status_color, item.status_border) : `<span class="pill">${safeText(item.status)}</span>`) : '';
  const para = target && target !== item.status ? `<span class="pill workflow-item-destino"><span class="pill-dot"></span>${safeText(target)}</span>` : '';
  return `<div class="workflow-item"><span class="workflow-item-ic" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="14" height="12" rx="2.5"/><path d="M3 8h14"/></svg></span><span class="workflow-item-texto"><span class="workflow-item-client">${safeText(item.cliente || 'Cliente não informado')}${formato ? ` · ${safeText(formato)}` : ''}</span><span class="workflow-item-name">${safeText(item.nome)}</span></span>${de || para ? `<span class="workflow-item-fluxo">${de}${de && para ? '<i aria-hidden="true">→</i>' : ''}${para}</span>` : ''}</div>`;
}
// Etapas do portão em pílula (família Formulário do padrão v2): conferir é a 1, a troca de status é a 2.
function etapasDoPortao(destino) { return typeof vbEtapasHtml === 'function' ? vbEtapasHtml(['Conferir', `Mudar para ${destino || 'o status novo'}`], 0) : ''; }
function closeWorkflowModal() { document.body.classList.remove('com-ranking-janela'); const origem=document.getElementById('workflow-modal')?.returnFocus; document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); pendingWorkflowChange = null; if(origem?.isConnected) origem.focus(); }
function openWorkflowModal(html) { document.body.classList.remove('com-ranking-janela'); document.getElementById('workflow-backdrop')?.remove(); document.getElementById('workflow-modal')?.remove(); const back=document.createElement('div'); back.id='workflow-backdrop'; back.className='workflow-backdrop'; back.onclick=closeWorkflowModal; const modal=document.createElement('section'); modal.id='workflow-modal'; modal.className='workflow-modal'; modal.innerHTML=html; if(janelaV2DoPortao(html)) modal.classList.add('d3-tema'); document.body.append(back,modal); }
// Portão da peça (o cartão da peça de workflowItemHtml no topo): a janela é toda escrita com os tokens V2
// (padrao-v2/zm-h-1-janelas.css), então leva d3-tema e escurece junto no tema Escuro. As outras janelas ficam folha clara.
function janelaV2DoPortao(html) { return /class="workflow-item"/.test(String(html||'')); }
// ── PEÇAS COMUNS DAS JANELAS V2-S (pranchas V2-S-Datas-da-Peca, V2-S-Conferir-Status, V2-S-Pergunta e
// V2-S-Previa-Grande, 19/11/2026) ─────────────────────────────────────────────────────────────────────────
// Uma janela só: vidro fumê de canto 20, título de 20 com a frase embaixo (e o avatar do cliente quando a janela é
// de uma peça), o fechar de 34 à direita e o pé com a nota à esquerda e os botões de 34 à direita. O desenho mora em
// padrao-v2/s-b.css (classes vbj-*), só com tokens: os três temas saem de lá.
const VBJ_ICONES = {
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  dir: '<path d="M9 6l6 6-6 6"/>',
  esq: '<path d="M15 6l-6 6 6 6"/>',
  certo: '<path d="M5 12l5 5 9-10"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  baixar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
};
function vbjIcone(nome, tamanho = 14) {
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VBJ_ICONES[nome] || ''}</svg>`;
}
// Sigla do cliente no avatar: as iniciais das duas primeiras palavras (Academia Lions → AL) ou as duas primeiras
// letras quando o nome é uma palavra só (Hebravet → HE). A cor é a da carteira (corDoClienteV2), sob um véu escuro.
function vbjSiglaDoCliente(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0].slice(0, 2)).toUpperCase();
}
function vbjAvatarHtml(nome, classe = 'vbj-av') {
  const cor = typeof corDoClienteV2 === 'function' ? corDoClienteV2(nome) : '#6B665E';
  return `<span class="${classe}" style="--c:${safeText(cor)}" aria-hidden="true">${safeText(vbjSiglaDoCliente(nome))}</span>`;
}
// Status com o ponto na cor do quadro (a mesma cor do menu de status).
function vbjStatusHtml(rotulo, cor = '') {
  if (!rotulo) return '';
  const c = cor || (typeof corDeStatus === 'function' ? corDeStatus(rotulo)?.cor : '') || '';
  return `<span class="vbj-st"${c ? ` style="--st:${safeText(c)}"` : ''}><i></i>${safeText(rotulo)}</span>`;
}
function vbjTopoHtml({ titulo = '', sub = '', av = '', fechar = 'closeWorkflowModal()', idTitulo = 'vbj-titulo' } = {}) {
  return `<div class="vbj-topo"><div class="vbj-cab">${av}<div class="vbj-tit"><h2 class="vbj-titulo" id="${idTitulo}">${safeText(titulo)}</h2>${sub ? `<span class="vbj-sub">${safeText(sub)}</span>` : ''}</div></div>
    <button type="button" class="vbj-x" aria-label="Fechar" title="Fechar" onclick="${fechar}">${vbjIcone('x', 16)}</button></div>`;
}
// Abre a janela V2 no #workflow-modal de sempre (o tutorial já espera ele fechar, PR #729) com a casca vbj.
function abrirJanelaV2(html, classes = '') {
  openWorkflowModal(html);
  const janela = document.getElementById('workflow-modal');
  if (!janela) return null;
  janela.classList.add('vbj', 'd3-tema', ...String(classes).split(/\s+/).filter(Boolean));
  janela.setAttribute('role', 'dialog');
  janela.setAttribute('aria-modal', 'true');
  if (janela.querySelector('#vbj-titulo')) janela.setAttribute('aria-labelledby', 'vbj-titulo');
  return janela;
}
// Todo registro de histórico do painel passa por aqui — checklist de qualidade,
// troca de responsáveis, ajuste de prazo. Ligando esta função, o histórico
// inteiro passa a nascer no banco da Vybe em vez de nascer no Monday.
// A NOTA NUNCA SEGURA O TRABALHO.
//
// Isto aqui grava a nota no historico da peca — "fulano mudou de X para Y, e o
// motivo foi este". Toda troca de status passa por ela ANTES de a troca
// acontecer, e ela estava deixando o erro subir. Resultado: se a nota falhasse
// por qualquer razao, a troca de status era abortada e a pessoa via so um erro
// vermelho. Foi o que o time viu tentando mudar para "Agendar".
//
// A ordem estava certa (registrar antes de mexer), a consequencia e que estava
// errada: o que a pessoa PEDIU foi trocar o status; a nota e efeito colateral.
// Agora, se a nota nao entrar, ela avisa e devolve false — e quem chamou segue
// em frente. Melhor uma peca certa com o historico incompleto do que uma peca
// parada com o historico limpo.
async function postItemUpdate(itemId, body) {
  const item = (typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null) || { id: itemId };
  try {
    const pelaEscritaDupla = await tentarEscritaDupla(item, { acao:'comentario', item:String(itemId), texto:String(body) });
    if (pelaEscritaDupla) return true;
    const mutation = `mutation($item: ID!, $body: String!) { create_update(item_id: $item, body: $body) { id } }`;
    return await mondayQuery(mutation, { item:String(itemId), body:String(body) });
  } catch (erro) {
    console.warn('Nota de histórico não gravada:', erro);
    showToast('A alteração foi feita. A nota no histórico não pôde ser gravada.', 'info', 6000);
    return false;
  }
}
function qualityChecklistFor(item) { const fmt = String(item.formato || item.tipo || '').toLowerCase(); const common=['Arquivo final correto e sem versão provisória','Copy, legenda e CTA revisados','Cliente e responsável pela publicação confirmados']; if (/reels|vídeo|video|motion|fotografia/.test(fmt)) return [...common,'Capa, áudio e proporção validados','Link de entrega ou arquivo final disponível']; if (/carrossel/.test(fmt)) return [...common,'Sequência das páginas revisada','Capa e última página com CTA confirmadas']; return [...common,'Dimensões e identidade visual conferidas','Link ou arquivo final disponível']; }
// A conta "x de N" das caixas da conferência. Na janela V2-S (.vbc) ela mora no cabeçalho da lista, com a barrinha;
// nas outras (direção de arte) segue a barra "x de N conferidos" em cima da lista.
function pintarConferidos(form) {
  if (!form) return;
  const caixas = [...form.querySelectorAll('input[type=checkbox]')], feitas = caixas.filter((c) => c.checked).length;
  const pct = caixas.length ? Math.round(feitas / caixas.length * 100) : 0;
  const conta = form.closest('.vbc')?.querySelector('.vbc-conta');
  if (conta) {
    const n = conta.querySelector('b'); if (n) n.textContent = `${feitas} de ${caixas.length}`;
    conta.style.setProperty('--p', `${pct}%`);
  } else {
    let barra = form.previousElementSibling?.classList?.contains('workflow-conferidos') ? form.previousElementSibling : null;
    if (!barra) { barra = document.createElement('div'); barra.className = 'workflow-conferidos'; form.before(barra); }
    barra.innerHTML = `<span><b>${feitas} de ${caixas.length}</b> conferidos</span><i style="--p:${pct}%"></i>`;
  }
  caixas.forEach((c) => c.closest('label')?.classList.toggle('feito', c.checked));
}
function updateQualityGateState() { pintarConferidos(document.getElementById('quality-checklist-form')); const form=document.getElementById('quality-checklist-form'); const button=document.getElementById('quality-submit'); if (!form || !button) return; button.disabled=[...form.querySelectorAll('input[type=checkbox]')].some(input => !input.checked); }

// ── CONFERIR ANTES DE TROCAR O STATUS (prancha V2-S-Conferir-Status) ──────────────────────────────────────────
// As três conferências (qualidade, material e a visual de "Para aprovação") são a mesma janela: a peça com o de → para
// no alto, as caixas reais com a conta "x de N" e a prévia ao lado com Ver grande, Abrir e Trocar. "Confirmar" fica
// apagado até tudo estar marcado (a conferência visual não tem caixa e já nasce liberada). O que cada uma grava no
// histórico e a ordem do bastão não mudam: só a janela.
function janelaDeConferenciaHtml({ item, option, titulo, sub, cab, idForm = '', mudar = '', checks = [], marca = '', nota, idBotao, onclick, acao, desligado = true }) {
  const formato = String(item.formato || item.tipo || '').trim();
  const veic = /^\d{4}-\d{2}-\d{2}/.test(String(item.veiculacao_iso || '')) ? ` · veiculação ${item.veiculacao_iso.slice(8, 10)}/${item.veiculacao_iso.slice(5, 7)}` : '';
  const destino = option?.label || '';
  // Cada caixa diz o que confere (peça, legenda ou briefing) e acende o bloco dela ao marcar. A etiqueta sai do
  // data-alvo-rotulo pelo CSS, fora do texto da caixa: o que o histórico registra (o texto da caixa) não muda.
  const caixas = checks.length
    ? `<div class="vbc-lista-cab"><b>${safeText(cab)}</b><span class="vbc-conta" style="--p:0%"><b>0 de ${checks.length}</b><span class="vbc-barra" aria-hidden="true"><i></i></span></span></div>
      <form id="${idForm}" class="vbc-checks" onchange="${mudar}">${checks.map((check, i) => { const alvo = alvoDoCheckDaConferencia(check); return `<label class="vbc-check"${alvo ? ` data-alvo="${alvo}" data-alvo-rotulo="${ROTULO_DO_ALVO_DA_CONFERENCIA[alvo]}"` : ''}><input type="checkbox" ${marca} name="${idForm}-${i}"><span class="vbc-caixa" aria-hidden="true">${vbjIcone('certo', 12)}</span><span class="vbc-check-txt">${safeText(check)}</span></label>`; }).join('')}</form>`
    : `<div class="vbc-lista-cab"><b>${safeText(cab)}</b></div>`;
  // A mesa de conferência (Paulo, 25/11/2026: "tem vários checklists mas não dá pra ver nada... deixa a publicação com a
  // legenda e o briefing"): a peça no alto; embaixo o checklist, a peça de verdade (imagem, carrossel ou vídeo tocável)
  // e a legenda com o briefing, cada bloco rolando só por dentro. No celular, empilhado com a peça primeiro.
  return `${vbjTopoHtml({ titulo, sub })}
    <div class="vbc-peca">${vbjAvatarHtml(item.cliente)}<span class="vbc-peca-txt"><b>${safeText(item.nome || 'Sem título')}</b><span>${safeText([item.cliente || 'Cliente não informado', formato].filter(Boolean).join(' · '))}${safeText(veic)}</span></span>
      <span class="vbc-de-para">${vbjStatusHtml(item.status, item.status_color)}${item.status && destino ? vbjIcone('dir', 14) : ''}${vbjStatusHtml(destino !== item.status ? destino : '', option?.color)}</span></div>
    <div class="vbc-grade vbc-mesa">
      <div class="vbc-esq">
        ${caixas}
        <p class="vbc-nota">${safeText(nota)}</p>
      </div>
      <div class="vbc-dir vbc-bloco" id="vbc-bloco-peca">
        <div class="vbc-prev-cab"><b>A peça</b><span id="vbc-prev-info">procurando</span></div>
        <div id="material-review-preview" class="vbc-palco"><div class="vbc-vazio">Carregando a peça…</div></div>
        <div id="vbc-fita" class="vbc-fita" role="group" aria-label="Arquivos da peça" hidden></div>
        <div id="vbc-prev-acoes" class="vbc-prev-acoes"></div>
      </div>
      <div class="vbc-textos">
        <section id="vbc-legenda" class="vbc-bloco vbc-texto" aria-labelledby="vbc-legenda-tit">
          <div class="vbc-bloco-cab"><b id="vbc-legenda-tit">Legenda</b><span id="vbc-legenda-info" class="vbc-bloco-info"></span><button type="button" id="vbc-legenda-editar" class="vbj-btn vbc-editar" hidden onclick="editarTextoDaConferencia('legenda')">Editar</button><button type="button" id="vbc-legenda-copiar" class="vbj-btn vbc-copiar" hidden onclick="copiarLegendaDaConferencia()">Copiar</button></div>
          <div id="vbc-legenda-corpo" class="vbc-bloco-corpo" tabindex="0" aria-label="Texto da legenda"><p class="vbc-bloco-vazio">Carregando…</p></div>
        </section>
        <section id="vbc-briefing" class="vbc-bloco vbc-texto" aria-labelledby="vbc-briefing-tit">
          <div class="vbc-bloco-cab"><b id="vbc-briefing-tit">Briefing</b><span id="vbc-briefing-info" class="vbc-bloco-info"></span><button type="button" id="vbc-briefing-editar" class="vbj-btn vbc-editar" hidden onclick="editarTextoDaConferencia('briefing')">Editar</button></div>
          <div id="vbc-briefing-corpo" class="vbc-bloco-corpo" tabindex="0" aria-label="Briefing da peça"><p class="vbc-bloco-vazio">Carregando…</p></div>
        </section>
      </div>
    </div>
    <div class="vbj-pe"><span class="vbj-passos"><span class="vbj-tracos" aria-hidden="true"><i class="on"></i><i></i></span>1 de 2 · conferir, depois mudar para ${safeText(destino || 'o status novo')}</span>
      <button type="button" class="vbj-btn" onclick="closeWorkflowModal()">Cancelar</button>
      <button id="${idBotao}" type="button" class="vbj-btn k"${desligado ? ' disabled' : ''} onclick="${onclick}">${safeText(acao)}</button></div>`;
}
// O que cada caixa confere. A legenda leva copy, CTA e canal; a peça, o arquivo e o que se vê nele (capa, áudio,
// proporção, dimensões, páginas, o link). O resto (cliente e responsável) não aponta para bloco nenhum.
const ROTULO_DO_ALVO_DA_CONFERENCIA = { peca: 'peça', legenda: 'legenda', briefing: 'briefing' };
function alvoDoCheckDaConferencia(texto) {
  const t = String(texto || '').toLowerCase();
  if (/legenda|copy/.test(t)) return 'legenda';
  if (/briefing/.test(t)) return 'briefing';
  // "Capa e última página com CTA" é da peça (a lâmina), não da legenda.
  if (/capa|[áa]udio|propor|dimens|identidade|sequ[êe]ncia|p[áa]gina|arquivo|link|pr[ée]via|material/.test(t)) return 'peca';
  if (/\bcta\b|canal/.test(t)) return 'legenda';
  return '';
}

// A MÍDIA DA PEÇA NA CONFERÊNCIA. Primeiro os anexos da peça (vídeos e todas as imagens, que viram carrossel com setas);
// sem anexo, o link de entrega pela prévia da entrega (area=previa_entrega: a miniatura do Drive e o vídeo em
// area=video_entrega, por partes e com id assinado), a mesma que o baralho das aprovações usa. "nada" só quando não
// há arquivo nem link. Vídeo anexado toca pelo download autenticado (area=baixar) até 60 MB, como a prévia do Conteúdo;
// acima disso, a capa com "Abrir". Itens: { tipo: imagem | video, src, capa, nome, abrir, imagem (índice na Prévia grande) }.
const VIDEO_ANEXO_TETO = 60 * 1024 * 1024;
// A ORDEM DOS ARQUIVOS DA PEÇA (frente s-z): pelo número do fim do nome ("… QUARTA SEM PRESSA - 01.png", 02, 03…), que é
// como o time numera as lâminas. Sem número, o arquivo fica depois dos numerados, na ordem em que veio (o vídeo antes da
// capa, como antes). Repetido (o mesmo arquivo anexado e na pasta, pelo id do Drive ou pelo nome) entra uma vez só, o
// anexo primeiro.
function numeroDoArquivo(nome) {
  const m = String(nome || '').replace(/\.[a-z0-9]{2,5}$/i, '').match(/(\d{1,4})\D*$/);
  return m ? Number(m[1]) : null;
}
function juntarArquivosDaPeca(anexos = [], daPasta = []) {
  const vistos = new Set(), todos = [];
  for (const it of [...anexos, ...daPasta]) {
    const nome = String(it?.nome || '').trim().toLowerCase(), chave = String(it?.chave || '');
    if ((chave && vistos.has('id:' + chave)) || (nome && vistos.has('nome:' + nome))) continue;
    if (chave) vistos.add('id:' + chave);
    if (nome) vistos.add('nome:' + nome);
    todos.push(it);
  }
  return todos.map((it, i) => ({ it, i, n: numeroDoArquivo(it.nome) }))
    .sort((a, b) => (a.n ?? Infinity) - (b.n ?? Infinity) || a.i - b.i).map((x) => x.it);
}
// Um arquivo da pasta de entrega (server/previa-entrega.js, itemDaPasta) no formato do palco.
function itemDaPastaNaConferencia(x) {
  if (!x || (x.tipo !== 'imagem' && x.tipo !== 'video')) return null;
  const capa = x.thumb || '';
  const it = x.tipo === 'video'
    ? { tipo: 'video', src: x.quadro || '', capa, nome: String(x.nome || 'Vídeo da pasta'), abrir: x.abrir || '' }
    : { tipo: 'imagem', src: x.grande || capa, capa, nome: String(x.nome || 'Imagem da pasta'), abrir: x.abrir || '' };
  return it.src || it.capa ? { ...it, chave: String(x.id || ''), origem: 'entrega' } : null;
}
function midiaDaConferencia(detail, entrega = null) {
  const ehVideo = typeof eVideoDoMaterial === 'function' ? eVideoDoMaterial
    : (a) => /^\.?(mp4|mov|webm|m4v|avi|mkv)$/i.test(String(a?.file_extension || '')) || /\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(String(a?.name || ''));
  const todos = [...(detail?.assets || []), ...(detail?.updates || []).flatMap((u) => u?.assets || [])];
  const imagens = (typeof statusContextPreviewAssets === 'function' ? statusContextPreviewAssets(detail) : []).filter((a) => !ehVideo(a));
  const videos = todos.filter(ehVideo).map((a) => {
    const bytes = Number(a.file_size || 0), local = a.local_id && bytes > 0 && bytes <= VIDEO_ANEXO_TETO;
    return { tipo: 'video', src: local ? `/api/painel?area=baixar&arquivo=${encodeURIComponent(a.local_id)}` : '', capa: a.url_thumbnail || '',
      nome: String(a.name || 'Vídeo anexado'), abrir: a.link_drive || a.public_url || a.url || '', chave: String(a.id || '') };
  });
  const anexos = [...videos, ...imagens.map((a) => ({ tipo: 'imagem', src: a.public_url || a.url || a.url_thumbnail || '', capa: a.url_thumbnail || '',
    nome: String(a.name || 'Imagem anexada'), abrir: a.link_drive || a.public_url || a.url || '', chave: String(a.id || ''), asset: a }))].filter((x) => x.src || x.capa);
  const e = entrega && typeof entrega === 'object' ? entrega : null;
  // Frente s-z: os arquivos da pasta do link de entrega (previa_entrega com a lista inteira) entram junto com os anexos.
  // O "01" anexado com o "02" e o "03" só na pasta era o caso do print (Gonzalez, "Dezembro começa à mesa").
  const daPasta = Array.isArray(e?.itens) ? e.itens.map(itemDaPastaNaConferencia).filter(Boolean) : [];
  if (anexos.length || daPasta.length) {
    const itens = juntarArquivosDaPeca(anexos, daPasta);
    // As imagens, na ordem do palco, são as da Prévia grande (Ver grande passa entre todas, as da pasta também).
    const material = [];
    for (const it of itens) if (it.tipo === 'imagem') { it.imagem = material.length; material.push(it.asset || { name: it.nome, url_thumbnail: it.capa, public_url: it.src, link_drive: it.abrir }); }
    itens.forEach((it) => { delete it.asset; delete it.chave; });
    const fonte = anexos.length ? 'anexo' : 'entrega';
    const comPasta = anexos.length > 0 && itens.some((it) => it.origem === 'entrega');
    return { fonte, itens, n: itens.length, abrir: fonte === 'entrega' ? (e.abrir || e.link || itens[0].abrir) : itens[0].abrir, material, comPasta };
  }
  if (e) {
    const abrir = e.abrir || e.link || '';
    // quadroDe: a miniatura que o Conteúdo mediu e achou preta (vybe-mundo-conteudo.js); ela não serve de capa.
    const capa = e.quadroDe ? '' : (e.thumb || '');
    const video = e.tipo === 'video' ? (e.quadro || e.video || '') : '';
    if (e.tipo === 'video' && (video || capa)) return { fonte: 'entrega', itens: [{ tipo: 'video', src: video, capa, nome: e.nome || 'Vídeo · link de entrega', abrir }], n: 1, abrir };
    if (capa) return { fonte: 'entrega', itens: [{ tipo: 'imagem', src: capa, capa, nome: e.nome || 'Link de entrega', abrir }], n: Number(e.n) || 1, abrir };
    if (abrir) return { fonte: 'entrega', itens: [], n: 0, abrir };
  }
  return { fonte: 'nada', itens: [], n: 0, abrir: '' };
}

// A LEGENDA E O BRIEFING DA PEÇA, só leitura. Legenda: a do planejamento aprovado pelo cliente (detail.planejamento, a
// mesma do VybeHub e da página de aprovação); sem ela, a seção ou linha "Legenda" do briefing (legendaDaPrevia, a da
// Prévia grande). Briefing: o da peça (cadastro ou o update do modelo, briefingDaPeca) dividido em partes
// (briefingEmSecoes); o essencial (objetivo, mensagem, CTA, referências, observações) vem primeiro e o resto depois,
// sem a parte da legenda. Sem briefing, o pedido do planejamento (objetivo, tema, telas, referência, observação).
const ESSENCIAL_DO_BRIEFING = [['Objetivo', /^objetivo/i, 'objetivo'], ['Mensagem', /^(mensagem|copy|tema|hook|gancho|ideia)/i, 'tema'],
  ['CTA', /^(cta|chamada)/i, ''], ['Referências', /^refer/i, 'referencia'], ['Observações', /^(observa|obs\b)/i, 'observacao']];
function textosDaConferencia(detail) {
  const plan = detail?.planejamento && typeof detail.planejamento === 'object' ? detail.planejamento : null;
  let legenda = { texto: '', origem: '' };
  if (String(plan?.legenda || '').trim()) legenda = { texto: String(plan.legenda).trim(), origem: 'do planejamento aprovado' };
  else {
    const t = typeof legendaDaPrevia === 'function' ? String(legendaDaPrevia(detail) || '').replace(/^legenda( do post)?:\s*/i, '').trim() : '';
    if (t) legenda = { texto: t, origem: 'do briefing' };
  }
  const b = typeof briefingDaPeca === 'function' ? briefingDaPeca(detail) : null;
  const secoes = b && typeof briefingEmSecoes === 'function' ? briefingEmSecoes(b.texto) : [];
  const linhas = secoes.flatMap((s) => s.linhas);
  const essencial = [], usadas = new Set();
  for (const [rotulo, re, campo] of ESSENCIAL_DO_BRIEFING) {
    const achou = linhas.find((l) => l.valor && re.test(String(l.rotulo || '').trim()));
    if (achou) usadas.add(achou);
    const valor = achou ? String(achou.valor) : campo && plan ? String(plan[campo] || '').trim() : '';
    if (valor) essencial.push({ rotulo, valor });
  }
  if (String(plan?.ajuste_cliente || '').trim()) essencial.push({ rotulo: 'Ajuste do cliente', valor: String(plan.ajuste_cliente).trim() });
  // O resto sem a parte da legenda (ela tem o bloco dela) e sem as linhas que já estão no essencial.
  const resto = secoes.filter((s) => !/^legenda/i.test(String(s.titulo || '')))
    .map((s) => ({ ...s, linhas: s.linhas.filter((l) => !usadas.has(l)) })).filter((s) => s.linhas.length);
  if (!b && plan && Array.isArray(plan.telas) && plan.telas.length) resto.push({ titulo: 'Telas', linhas: plan.telas.map((t) => ({ tipo: 'item', valor: String(t) })) });
  const origem = b ? (b.origem === 'histórico' ? 'do histórico da peça' : 'do cadastro da peça') : essencial.length || resto.length ? 'do planejamento' : '';
  return { legenda, briefing: { essencial, secoes: resto, origem, tem: Boolean(essencial.length || resto.length) } };
}
function legendaDaConferenciaHtml(legenda) {
  return legenda?.texto ? `<p class="vbc-legenda-txt">${safeText(legenda.texto)}</p>` : '<p class="vbc-bloco-vazio">Sem legenda cadastrada</p>';
}
function briefingDaConferenciaHtml(briefing) {
  if (!briefing?.tem) return '<p class="vbc-bloco-vazio">Sem briefing</p>';
  // Classes próprias (vbc-bl-*): as brief-* da tela do briefing têm cor fixa com !important no CSS antigo e sumiriam no
  // vidro escuro.
  const linha = (l) => l.tipo === 'arte' ? `<pre class="vbc-bl-arte">${safeText(l.valor)}</pre>`
    : l.tipo === 'subtitulo' ? `<p class="vbc-bl-sub">${safeText(l.rotulo)}</p>`
    : l.rotulo ? `<p class="vbc-bl-par"><span>${safeText(l.rotulo)}</span> ${safeText(l.valor || '')}</p>`
    : `<p class="vbc-bl-txt${l.tipo === 'item' ? ' vbc-bl-item' : ''}">${safeText(l.valor || '')}</p>`;
  const essencial = briefing.essencial.length ? `<dl class="vbc-essencial">${briefing.essencial.map((x) => `<div><dt>${safeText(x.rotulo)}</dt><dd>${safeText(x.valor)}</dd></div>`).join('')}</dl>` : '';
  const resto = briefing.secoes.map((s) => `<div class="vbc-brief-parte">${s.titulo ? `<h4>${safeText(s.titulo)}</h4>` : ''}${s.linhas.map(linha).join('')}</div>`).join('');
  return `${essencial}${resto ? `<div class="vbc-brief-resto">${essencial ? '<h4 class="vbc-brief-tudo">Briefing completo</h4>' : ''}${resto}</div>` : ''}`;
}
// O palco: a mídia na proporção dela (contain, sem corte), com setas e "i de N" quando há mais de uma. Vídeo com controles,
// mudo no início e parado em 1 s (o Reels que abre do preto mostra imagem); sem endereço que o navegador toque, a capa
// com ▶ e o Abrir embaixo.
function palcoDaConferenciaHtml(midia, indice = 0) {
  const it = midia?.itens?.[indice];
  if (!it) {
    return midia?.abrir
      ? '<div class="vbc-vazio"><b>Sem prévia visual</b>O link de entrega não pôde ser lido aqui. Abra-o para conferir antes de confirmar.</div>'
      : '<div class="vbc-vazio"><b>Sem prévia</b>Nenhum arquivo ou link de entrega foi localizado nesta peça.</div>';
  }
  const total = midia.itens.length;
  // Frente s-z: setas grandes sobre a mídia (← → no teclado) e o "i de N" no alto do palco.
  const setas = total > 1
    ? `<button type="button" class="vbj-ic vbc-seta antes" aria-label="Arquivo anterior" title="Arquivo anterior (←)" onclick="passarPreviaDaConferencia(-1)">${vbjIcone('esq', 22)}</button><button type="button" class="vbj-ic vbc-seta depois" aria-label="Próximo arquivo" title="Próximo arquivo (→)" onclick="passarPreviaDaConferencia(1)">${vbjIcone('dir', 22)}</button><span class="vbc-midia-conta" aria-live="polite">${indice + 1} de ${total}</span>`
    : '';
  const pasta = midia.fonte === 'entrega' && midia.n > total && total < 2 ? ` · 1 de ${midia.n} na pasta` : '';
  const conta = total > 1 ? `${indice + 1} de ${total} · ` : '';
  const legenda = `<small id="material-review-caption" class="vbc-legenda">${safeText(conta + (it.nome || 'Peça') + pasta)}</small>`;
  if (it.tipo === 'video' && it.src) {
    const src = String(it.src).split('#')[0];
    return `<video id="material-review-video" class="vbc-video" src="${safeText(src)}#t=1" controls muted playsinline preload="metadata" aria-label="Vídeo: ${safeText(it.nome || 'peça')}" data-capa="${safeText(it.capa || '')}" onloadeddata="videoDaConferenciaAbriu(this)" onerror="videoDaConferenciaFalhou(this)"></video>${setas}${legenda}`;
  }
  const play = it.tipo === 'video' ? '<span class="vbc-play" aria-hidden="true">▶</span>' : '';
  const grande = it.tipo === 'imagem' && Number.isInteger(it.imagem) ? ` title="Clique para ver em tamanho grande" onclick="abrirPreviaGrande(${it.imagem})"` : '';
  const reserva = it.capa && it.src && it.capa !== it.src ? ` data-fallback-src="${safeText(it.capa)}"` : '';
  return `<img id="material-review-img" src="${safeText(it.src || it.capa)}"${reserva} alt="${it.tipo === 'video' ? 'Capa do vídeo' : 'Prévia'}: ${safeText(it.nome || 'material')}" loading="eager"${grande} onerror="materialReviewPreviewFailed(this)">${play}${setas}${it.tipo === 'video' ? `<small id="material-review-caption" class="vbc-legenda">${safeText(conta)}Vídeo · use Abrir para assistir</small>` : legenda}`;
}
function openQualityGate(item, option) {
  if (precisaDeConferenciaFinal(item, option)) return openMaterialReviewGate(item, option);
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option, titulo: 'Checklist de qualidade', sub: 'confira a prévia e os pontos essenciais antes da publicação',
    cab: `Antes de mandar para ${option.label}`, idForm: 'quality-checklist-form', mudar: 'updateQualityGateState()', checks: qualityChecklistFor(item),
    nota: 'O registro fica no histórico da peça. Alterações diretas no Monday não passam por esta conferência.',
    idBotao: 'quality-submit', onclick: 'submitQualityChecklist()', acao: 'Continuar' }), 'vbc vbc-mesa');
  ligarFilaDaConferencia(item, option, 'qualidade');
  loadMaterialReviewPreview(item.id);
  updateQualityGateState();
}
async function submitQualityChecklist() { const flow=pendingWorkflowChange; const form=document.getElementById('quality-checklist-form'); if (!flow || !form) return; const checks=[...form.querySelectorAll('label')].map(label=>label.textContent.trim()).filter(Boolean); const button=document.getElementById('quality-submit'); if (button) button.disabled=true; try { await postItemUpdate(flow.item.id, `[Vybe OS · Checklist de qualidade]\nDestino: ${flow.option.label}\nFormato: ${flow.item.formato || flow.item.tipo || 'Conteúdo'}\nValidado: ${checks.join(' | ')}`); const {item,option}=flow; const seguinte=proximaDaConferencia(); closeWorkflowModal(); if(statusNeedsMaterialReview(option)) return openMaterialReviewGate(item,option); if (statusNeedsHandoff(item,option)) openHandoffGate(item,option); else oferecerProximaConferencia(seguinte, await commitStatusChange(item,option)); } catch(e) { if(button) button.disabled=false; showToast(`Não foi possível registrar o checklist: ${e.message}`,'err',7000); } }
function materialReviewChecklistFor(item, option) { const target=normalizedWorkflowStatus(option?.label); const scheduled=target==='agendado'; const format=String(item?.formato||item?.tipo||'conteúdo'); return scheduled ? [`Conferi a prévia final de ${format} antes do agendamento`,`Confirmei que legenda, CTA, canal e data de publicação estão corretos`,`O arquivo ou link aberto corresponde a esta demanda`] : [`Conferi a prévia do material entregue ou publicado`,`Confirmei que o destino final corresponde a esta demanda`,`Não há pendência de publicação ou material incorreto antes de finalizar`]; }
function updateMaterialReviewState(){ pintarConferidos(document.getElementById('material-review-form')); const checks=[...document.querySelectorAll('input[data-material-review-check]')]; const button=document.getElementById('material-review-submit'); if(button) button.disabled=!checks.length||checks.some(check=>!check.checked); }
function materialReviewPreviewFailed(image){ const fallback=String(image?.dataset?.fallbackSrc||''); if(fallback&&image.dataset.fallbackTried!=='true'){ image.dataset.fallbackTried='true'; image.src=fallback; return; } const holder=image.closest('.vbc-palco'); if(holder) holder.innerHTML='<div class="vbc-vazio"><b>Prévia indisponível</b>Abra o material vinculado para conferir o arquivo final.</div>'; }
// A prévia ao lado das caixas. Com mais de uma arte, as setas do palco passam entre elas e o cabeçalho diz "1 de 3":
// conferir só a primeira e aprovar seria aprovar no escuro o resto do carrossel. Embaixo, Ver grande (a Prévia grande
// com todas), Abrir (o link de entrega ou o próprio arquivo) e Trocar (fecha e abre a peça para anexar outro).
function acoesDaPreviaDaConferencia({ temArte = false, abrir = '' } = {}) {
  const acoes = document.getElementById('vbc-prev-acoes');
  if (!acoes) return;
  acoes.innerHTML = `${temArte ? `<button type="button" class="vbj-btn" onclick="abrirPreviaGrande(PREVIA_GRANDE_INDICE)">${vbjIcone('olho', 14)}Ver grande</button>` : ''}${abrir ? `<a class="vbj-btn" href="${safeText(abrir)}" target="_blank" rel="noopener">${vbjIcone('link', 14)}Abrir</a>` : ''}<button type="button" class="vbj-btn vbj-txt" onclick="const f=pendingWorkflowChange;closeWorkflowModal();if(f?.item)openItemWorkspace(f.item.id)">${temArte || abrir ? 'Trocar' : 'Anexar material'}</button>`;
}
// A mesa: busca a peça uma vez (area=peca) e pinta os três blocos. A mídia vem de midiaDaConferencia; sem anexo, a
// prévia da entrega (esperarPreviaDaEntrega). A legenda e o briefing vêm do mesmo detalhe (textosDaConferencia).
let MIDIA_DA_CONFERENCIA = { fonte: 'nada', itens: [], n: 0, abrir: '' };
let MIDIA_DA_CONFERENCIA_INDICE = 0;
let LEGENDA_DA_CONFERENCIA = '';
// O detalhe da peça aberta na mesa (a legenda e o briefing editados ali saem dele e voltam para ele).
let DETALHE_DA_CONFERENCIA = null;
// Só o link de entrega registrado conta (a nota "[Vybe OS · Link de entrega]"): workspaceDeliveryInfo cai no próprio
// anexo quando não há link, e o anexo já está no palco.
function linkDeEntregaDaConferencia(detail) {
  const d = typeof workspaceDeliveryInfo === 'function' ? workspaceDeliveryInfo(detail) : null;
  return d?.url && d.label === 'LINK DE ENTREGA REGISTRADO' ? d.url : '';
}
const ehPastaDoDrive = (url) => /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\//i.test(String(url || ''));
// A pasta da entrega com a lista inteira, mesmo com anexo (todos=1, server/previa-entrega.js). null em 15 s no pior caso.
function pastaDaEntregaDaConferencia(itemId, prazo = 15000) {
  const pedido = fetch(`/api/painel?area=previa_entrega&todos=1&item=${encodeURIComponent(String(itemId || ''))}`, { credentials: 'same-origin' })
    .then((r) => (r.ok ? r.json() : null)).then((d) => d?.previa || null).catch(() => null);
  return Promise.race([pedido, new Promise((ok) => setTimeout(() => ok(null), prazo))]);
}
function infoDaMidiaDaConferencia(midia) {
  const n = midia.itens.length;
  if (midia.fonte === 'anexo') return midia.comPasta ? `anexo e pasta de entrega · ${n} arquivos` : n > 1 ? `anexo · ${n} arquivos` : 'anexo da peça';
  if (midia.fonte === 'entrega') return n > 1 ? `link de entrega · ${n} arquivos` : 'link de entrega';
  return 'sem arquivo';
}
async function loadMaterialReviewPreview(itemId){
  const holder=document.getElementById('material-review-preview');
  if(!holder) return;
  const info=document.getElementById('vbc-prev-info');
  ligarAlvosDaConferencia();
  let detail;
  try { detail=await fetchWorkspaceItem(itemId); }
  catch(error){
    if(!document.body.contains(holder)) return;
    holder.innerHTML='<div class="vbc-vazio"><b>Prévia indisponível</b>Não foi possível carregar os arquivos da demanda agora. Feche e tente novamente antes de confirmar.</div>';
    if(info) info.textContent='indisponível';
    acoesDaPreviaDaConferencia({});
    DETALHE_DA_CONFERENCIA=null;
    pintarTextosDaConferencia(null);
    return;
  }
  if(!document.body.contains(holder)) return;
  DETALHE_DA_CONFERENCIA=detail;
  pintarTextosDaConferencia(detail);
  PREVIA_DA_PECA='';
  PREVIA_GRANDE_INDICE=0;
  const mostrar=(midia, manter='')=>{
    // Ao chegar a pasta, o palco fica no mesmo arquivo que a pessoa está vendo (pelo nome), não volta para o 1.
    const i=manter ? midia.itens.findIndex((x)=>x.nome===manter) : -1;
    MIDIA_DA_CONFERENCIA=midia; MIDIA_DA_CONFERENCIA_INDICE=i>=0?i:0;
    PREVIA_MATERIAL=midia.material||[];
    pintarPalcoDaConferencia();
    if(info) info.textContent=infoDaMidiaDaConferencia(midia);
    acoesDaPreviaDaConferencia({ temArte: PREVIA_MATERIAL.length>0, abrir: midia.abrir||'' });
  };
  let midia=midiaDaConferencia(detail);
  const link=linkDeEntregaDaConferencia(detail);
  if(midia.fonte==='nada'){
    const delivery=workspaceDeliveryInfo(detail);
    if(delivery?.url){
      if(info) info.textContent='link de entrega';
      holder.innerHTML='<div class="vbc-vazio">Abrindo o link de entrega…</div>';
      const previa=await esperarPreviaDaEntrega(itemId);
      if(!document.body.contains(holder)) return;
      midia=midiaDaConferencia(detail, previa || { abrir: delivery.url });
    }
    return mostrar(midia);
  }
  mostrar(midia);
  // Com anexo e link de entrega para uma pasta: os outros arquivos da peça costumam estar só lá. Mostra o anexo já e
  // junta a pasta quando ela chegar.
  if(midia.fonte==='anexo' && ehPastaDoDrive(link)){
    const previa=await pastaDaEntregaDaConferencia(itemId);
    if(!document.body.contains(holder) || !Array.isArray(previa?.itens)) return;
    const junta=midiaDaConferencia(detail, previa);
    if(junta.itens.length>midia.itens.length) mostrar(junta, MIDIA_DA_CONFERENCIA.itens[MIDIA_DA_CONFERENCIA_INDICE]?.nome||'');
  }
}
function pintarPalcoDaConferencia(){
  const holder=document.getElementById('material-review-preview');
  if(!holder) return;
  holder.innerHTML=palcoDaConferenciaHtml(MIDIA_DA_CONFERENCIA, MIDIA_DA_CONFERENCIA_INDICE);
  const v=holder.querySelector('video'); if(v) v.muted=true;
  const it=MIDIA_DA_CONFERENCIA.itens[MIDIA_DA_CONFERENCIA_INDICE];
  if(Number.isInteger(it?.imagem)) PREVIA_GRANDE_INDICE=it.imagem;
  pintarFitaDaConferencia();
}
// A fita de miniaturas embaixo do palco (só com mais de um arquivo): tocar numa leva o palco até ela.
function fitaDaConferenciaHtml(midia, indice = 0) {
  const itens = midia?.itens || [];
  if (itens.length < 2) return '';
  return itens.map((it, i) => {
    const capa = it.capa || (it.tipo === 'imagem' ? it.src : '');
    const rosto = capa ? `<img src="${safeText(capa)}" alt="" loading="lazy">` : `<span class="vbc-fita-sem" aria-hidden="true">${it.tipo === 'video' ? '▶' : i + 1}</span>`;
    return `<button type="button" class="vbc-fita-item${i === indice ? ' on' : ''}" aria-label="Arquivo ${i + 1} de ${itens.length}: ${safeText(it.nome || '')}"${i === indice ? ' aria-current="true"' : ''} title="${safeText(it.nome || '')}" onclick="irParaPreviaDaConferencia(${i})">${rosto}${it.tipo === 'video' && capa ? '<i aria-hidden="true">▶</i>' : ''}</button>`;
  }).join('');
}
function pintarFitaDaConferencia() {
  const fita = document.getElementById('vbc-fita');
  if (!fita) return;
  const html = fitaDaConferenciaHtml(MIDIA_DA_CONFERENCIA, MIDIA_DA_CONFERENCIA_INDICE);
  fita.hidden = !html;
  fita.innerHTML = html;
  // Só a fita rola para a miniatura da vez (scrollIntoView rolaria a janela inteira no celular).
  const on = fita.querySelector('.on');
  if (on) {
    const l = on.offsetLeft, r = l + on.offsetWidth;
    if (l < fita.scrollLeft) fita.scrollLeft = Math.max(0, l - 4);
    else if (r > fita.scrollLeft + fita.clientWidth) fita.scrollLeft = r - fita.clientWidth + 4;
  }
}
// A prévia da entrega pela mesma leitura do Conteúdo (VybeConteudo.previaDe: area=arquivos, area=peca e
// area=previa_entrega, guardada por sessão e com a miniatura preta já medida). Sem o módulo (fora do mundo), o
// endpoint direto. Responde null em 15 s no pior caso: a janela nunca fica presa em "Abrindo".
function esperarPreviaDaEntrega(itemId, prazo = 15000){
  const ref=String(itemId||'');
  const vc=globalThis.VybeConteudo;
  if(!vc?.previaDe){
    return fetch(`/api/painel?area=previa_entrega&item=${encodeURIComponent(ref)}`, { credentials:'same-origin' })
      .then((r)=>r.ok?r.json():null).then((d)=>d?.previa||null).catch(()=>null);
  }
  const ja=vc.previaDe(ref);
  if(ja!==undefined) return Promise.resolve(ja);
  return new Promise((ok)=>{
    let feito=false;
    const fim=(v)=>{ if(!feito){ feito=true; ok(v??null); } };
    if(typeof vc.ouvirPrevia==='function') vc.ouvirPrevia((r)=>{ if(!feito&&String(r)===ref){ const v=vc.previaDe(ref); if(v!==undefined) fim(v); } });
    setTimeout(()=>fim(vc.previaDe(ref)), prazo);
  });
}
// O vídeo abriu, mas sem imagem (HEVC .mov no Chrome abre o som e não o quadro), ou não abriu: fica a capa com ▶ e o Abrir.
function videoDaConferenciaAbriu(video){ if(video && !(video.videoWidth>0)) videoDaConferenciaFalhou(video); }
function videoDaConferenciaFalhou(video){
  const it=MIDIA_DA_CONFERENCIA.itens[MIDIA_DA_CONFERENCIA_INDICE];
  if(!it || it.tipo!=='video' || !it.src) return;
  MIDIA_DA_CONFERENCIA.itens[MIDIA_DA_CONFERENCIA_INDICE]={ ...it, src:'' };
  if(it.capa) return pintarPalcoDaConferencia();
  const holder=video?.closest?.('.vbc-palco');
  if(holder) holder.innerHTML='<div class="vbc-vazio"><b>O vídeo não abre aqui</b>Use Abrir para assistir antes de confirmar.</div>';
}
function passarPreviaDaConferencia(passo) {
  const total = MIDIA_DA_CONFERENCIA.itens.length;
  if (total < 2) return;
  MIDIA_DA_CONFERENCIA_INDICE = (MIDIA_DA_CONFERENCIA_INDICE + passo + total) % total;
  pintarPalcoDaConferencia();
}
function irParaPreviaDaConferencia(indice) {
  const i = Number(indice);
  if (!Number.isInteger(i) || i < 0 || i >= MIDIA_DA_CONFERENCIA.itens.length || i === MIDIA_DA_CONFERENCIA_INDICE) return;
  MIDIA_DA_CONFERENCIA_INDICE = i;
  pintarPalcoDaConferencia();
}

// ── A FILA DA CONFERÊNCIA (frente s-z, Paulo, 25/11/2026: "um botão pra ir pro próximo ou voltar") ────────────────────
// "‹ Anterior · 3 de 12 · Próxima ›" no alto da janela passa para a peça vizinha que está no MESMO status de origem, com
// a mesma conferência e o mesmo destino, para a mesma pessoa conferir uma atrás da outra. A fila é a de "Para aprovar
// agora" (VybeConteudo.filaParaAprovar, a mesma conta do filaDecidir do Hoje: aprovação interna, a data do cliente
// primeiro) quando a peça está nela; senão, as peças do mesmo status visíveis no quadro (DADOS), pela data do cliente.
// Sem fila clara (peça sozinha, fora das duas) o botão não aparece. Os checks marcados não passam de uma peça para outra:
// trocar reabre a janela do zero.
let FILA_DA_CONFERENCIA = null;
const dataDaFila = (p) => String(p?.veiculacao_iso || p?.veiculacao || p?.prazo_iso || p?.prazo || '9');
function filaDaConferenciaDe({ item, option, aprovar = null, quadro = [], opcoesDe = () => [] } = {}) {
  const id = String(item?.id ?? ''), alvo = normalizedWorkflowStatus(option?.label);
  if (!id || !alvo) return null;
  let lista = null, origem = '';
  const daFila = Array.isArray(aprovar) ? aprovar.map((x) => x?.item).filter(Boolean) : [];
  if (daFila.some((p) => String(p.id) === id)) { lista = daFila; origem = 'aprovar'; }
  else {
    const st = normalizedWorkflowStatus(item.status);
    const mesmos = st ? (Array.isArray(quadro) ? quadro : []).filter((p) => p && normalizedWorkflowStatus(p.status) === st) : [];
    if (mesmos.some((p) => String(p.id) === id)) {
      lista = mesmos.map((p, i) => ({ p, i })).sort((a, b) => dataDaFila(a.p).localeCompare(dataDaFila(b.p)) || a.i - b.i).map((x) => x.p);
      origem = 'quadro';
    }
  }
  if (!lista) return null;
  // O mesmo destino na vizinha: a opção do quadro dela com o mesmo nome. A que não tem fica fora (outra conferência).
  const destino = (p) => (opcoesDe(p) || []).find((o) => o && o.ativa !== false && normalizedWorkflowStatus(o.label) === alvo) || null;
  const vistos = new Set();
  const pecas = lista.filter((p) => { const k = String(p.id); if (vistos.has(k)) return false; vistos.add(k); return true; })
    .map((p) => (String(p.id) === id ? { item, option } : { item: p, option: destino(p) })).filter((x) => x.option);
  const indice = pecas.findIndex((x) => String(x.item.id) === id);
  return pecas.length > 1 && indice >= 0 ? { pecas, indice, origem } : null;
}
function filaDaConferenciaAgora(item, option) {
  const vc = globalThis.VybeConteudo;
  let aprovar = null;
  try {
    const f = vc?.filaParaAprovar?.();
    if (Array.isArray(f?.fila)) aprovar = f.fila.map((i) => ({ ...i, item: vc.itemDaFila ? vc.itemDaFila(i) : null }));
  } catch { aprovar = null; }
  const quadro = typeof DADOS !== 'undefined' && Array.isArray(DADOS) ? DADOS : [];
  const opcoesDe = (p) => (typeof operationalStatusOptions === 'function' ? operationalStatusOptions(p) : (typeof STATUS_OPTIONS !== 'undefined' ? STATUS_OPTIONS : [])) || [];
  try { return filaDaConferenciaDe({ item, option, aprovar, quadro, opcoesDe }); } catch { return null; }
}
function filaDaConferenciaHtml(fila) {
  if (!fila || fila.pecas.length < 2) return '';
  const i = fila.indice, n = fila.pecas.length;
  return `<nav class="vbc-fila" aria-label="Peças da fila"><button type="button" class="vbj-btn vbc-fila-btn" onclick="passarPecaDaConferencia(-1)" title="Peça anterior (Shift+← ou PageUp)"${i === 0 ? ' disabled' : ''}>${vbjIcone('esq', 14)}Anterior</button><span class="vbc-fila-conta" aria-live="polite">${i + 1} de ${n}</span><button type="button" class="vbj-btn vbc-fila-btn" onclick="passarPecaDaConferencia(1)" title="Próxima peça (Shift+→ ou PageDown)"${i >= n - 1 ? ' disabled' : ''}>Próxima${vbjIcone('dir', 14)}</button></nav>`;
}
// Chamada por cada conferência depois de abrir a janela: calcula a fila e põe os botões no cabeçalho, ao lado do de → para.
function ligarFilaDaConferencia(item, option, porta) {
  const fila = filaDaConferenciaAgora(item, option);
  FILA_DA_CONFERENCIA = fila ? { ...fila, porta } : null;
  const peca = document.querySelector('#workflow-modal .vbc-peca');
  if (peca && fila) { peca.insertAdjacentHTML('beforeend', filaDaConferenciaHtml(fila)); peca.classList.add('com-fila'); }
}
function abrirConferenciaDaFila(item, option, porta) {
  const atual = (typeof findOperationalItem === 'function' && findOperationalItem(item?.id)) || item;
  const peca = { ...atual, status: atual.status || item.status };
  if (porta === 'visual') return abrirConferenciaVisual(peca, option);
  if (porta === 'material') return openMaterialReviewGate(peca, option);
  return openQualityGate(peca, option);
}
function passarPecaDaConferencia(passo) {
  const f = FILA_DA_CONFERENCIA;
  const alvo = f?.pecas?.[f.indice + passo];
  if (!alvo) return;
  closeWorkflowModal();
  abrirConferenciaDaFila(alvo.item, alvo.option, f.porta);
}
// A que vem depois desta (ou a de antes, se esta era a última): guardada ANTES de a troca de status tirar esta da fila.
function proximaDaConferencia() {
  const f = FILA_DA_CONFERENCIA;
  if (!f) return null;
  const alvo = f.pecas[f.indice + 1] || f.pecas[f.indice - 1];
  return alvo ? { ...alvo, porta: f.porta, status: alvo.item.status } : null;
}
// Depois de "Continuar" dar certo: "Conferir a próxima" numa janela pequena. Só se a vizinha ainda estiver no status de
// origem. Não é o aviso curto do canto: ele vira pílula escondida no celular e vai direto para o sino quando não há canto
// livre (ajustarAvisosCurtos), e a oferta sumiria. O Desfazer da troca fica por cima da janela (z-index próprio).
function oferecerProximaConferencia(seguinte, ok) {
  if (!ok || !seguinte) return;
  const agora = (typeof findOperationalItem === 'function' && findOperationalItem(seguinte.item.id)) || seguinte.item;
  if (normalizedWorkflowStatus(agora?.status) !== normalizedWorkflowStatus(seguinte.status)) return;
  const abrir = () => abrirConferenciaDaFila(agora, seguinte.option, seguinte.porta);
  const frase = [agora.cliente, agora.nome].filter(Boolean).join(' · ');
  abrirJanelaV2(`${vbjTopoHtml({ titulo: 'Feito', sub: frase ? `a próxima da fila: ${frase}` : 'a próxima peça da fila está esperando' })}
    <div class="vbj-pe"><span class="vbj-passos">Conferir a próxima peça agora?</span><button type="button" class="vbj-btn" onclick="closeWorkflowModal()">Fechar</button><button type="button" id="vbc-conferir-proxima" class="vbj-btn k">Conferir a próxima</button></div>`, 'vbc-proxima');
  const b = document.getElementById('vbc-conferir-proxima');
  if (b) { b.onclick = () => { closeWorkflowModal(); abrir(); }; b.focus(); }
}
// Teclado da mesa: ← → passam os arquivos; Shift+← Shift+→ (ou PageUp PageDown) passam as peças. Nada disso vale
// escrevendo (legenda, briefing), num vídeo com foco (as setas dele andam no tempo) ou com a Prévia grande aberta.
function teclaDaConferencia(e) {
  const j = document.getElementById('workflow-modal');
  if (!j || !j.classList.contains('vbc-mesa') || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const grande = document.getElementById('previa-grande');
  if (grande && grande.style.display !== 'none' && grande.getClientRects().length) return;
  const t = e.target, tag = String(t?.tagName || '');
  if (tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable || (tag === 'INPUT' && !/^(checkbox|radio|button)$/i.test(t.type || ''))) return;
  const peca = e.key === 'PageDown' || (e.shiftKey && e.key === 'ArrowRight') ? 1 : e.key === 'PageUp' || (e.shiftKey && e.key === 'ArrowLeft') ? -1 : 0;
  if (peca) {
    if (!j.querySelector('.vbc-fila')) return;
    e.preventDefault(); e.stopPropagation();
    return passarPecaDaConferencia(peca);
  }
  if (e.shiftKey || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') || tag === 'VIDEO' || MIDIA_DA_CONFERENCIA.itens.length < 2) return;
  e.preventDefault(); e.stopPropagation();
  passarPreviaDaConferencia(e.key === 'ArrowRight' ? 1 : -1);
}
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', teclaDaConferencia, true);
function pintarTextosDaConferencia(detail){
  const t=detail?textosDaConferencia(detail):{ legenda:{ texto:'', origem:'' }, briefing:{ tem:false, essencial:[], secoes:[], origem:'' } };
  LEGENDA_DA_CONFERENCIA=t.legenda.texto;
  const pintar=(id, html, info)=>{ const c=document.getElementById(`${id}-corpo`); if(c) c.innerHTML=html; const i=document.getElementById(`${id}-info`); if(i) i.textContent=info; };
  pintar('vbc-legenda', detail?legendaDaConferenciaHtml(t.legenda):'<p class="vbc-bloco-vazio">Não foi possível ler a legenda agora.</p>', t.legenda.origem);
  pintar('vbc-briefing', detail?briefingDaConferenciaHtml(t.briefing):'<p class="vbc-bloco-vazio">Não foi possível ler o briefing agora.</p>', t.briefing.origem);
  const copiar=document.getElementById('vbc-legenda-copiar'); if(copiar) copiar.hidden=!t.legenda.texto;
  // Editar ali mesmo (frente s-z): o botão só aparece para quem pode gravar no lugar de onde o texto vem.
  EDICAO_DA_CONFERENCIA=null;
  const botao=(id, pode, vazio, rotuloVazio)=>{ const b=document.getElementById(id); if(!b) return; b.hidden=!pode; b.disabled=false; b.textContent=vazio?rotuloVazio:'Editar'; };
  botao('vbc-legenda-editar', Boolean(detail && destinoDaLegendaDaConferencia(detail)), !t.legenda.texto, 'Escrever legenda');
  botao('vbc-briefing-editar', podeEditarBriefingDaConferencia(detail), !briefingDaPecaNaConferencia(detail), 'Escrever briefing');
}
// ── EDITAR A LEGENDA E O BRIEFING NA CONFERÊNCIA (frente s-z, Paulo, 25/11/2026: "seria bom poder editar o que não está
// ok... poderia ter ali já a opção de editar legenda") ─────────────────────────────────────────────────────────────────
// Grava no MESMO lugar de onde a janela lê (textosDaConferencia): a legenda do planejamento aprovado quando a peça está
// nele (a mesma que o VybeHub e a página de aprovação mostram), pela ação legenda_da_peca de area=planejamentos, com a
// permissão de editar o planejamento (detail.planejamento.pode_editar vem do servidor); senão, a seção "Legenda" do
// briefing, pela rota de sempre do briefing (gravarBriefing). O briefing inteiro vai pela mesma rota do briefing, que a
// gaveta já usa para qualquer pessoa da equipe com sessão. Nada disso marca a caixa "Copy, legenda e CTA revisados".
let EDICAO_DA_CONFERENCIA=null;
const briefingDaPecaNaConferencia=(detail)=>(typeof briefingDaPeca==='function' ? briefingDaPeca(detail)?.texto || '' : String(detail?.briefing || '').trim());
// 'planejamento', 'briefing' ou '' (sem botão). Planejamento com legenda: só quem edita o planejamento (senão a janela
// continuaria mostrando a do planejamento e a gravada no briefing ficaria escondida). Planejamento sem legenda: grava
// nele quem pode (o cliente passa a ver no VybeHub); quem não pode grava no briefing, que é o que a janela mostra.
function destinoDaLegendaDaConferencia(detail){
  if(!detail || typeof detail!=='object') return '';
  const plan=detail.planejamento && typeof detail.planejamento==='object' ? detail.planejamento : null;
  if(plan && plan.pode_editar===true) return 'planejamento';
  if(plan && String(plan.legenda||'').trim()) return '';
  return podeEditarBriefingDaConferencia(detail) ? 'briefing' : '';
}
// O briefing: a mesma regra da gaveta (editarBriefing aparece para quem abre a peça), com a ficha lida e a peça na mesa.
function podeEditarBriefingDaConferencia(detail){
  return Boolean(detail && typeof detail==='object' && String(detail.id ?? '') && typeof gravarBriefing==='function');
}
// O briefing com a legenda nova: troca o corpo da seção "Legenda" (ou tira a linha "Legenda: …" e põe a seção no fim).
// A legenda vai entre cercas (```), que o leitor do briefing não interpreta: quebras e "Link: …" ficam como estão.
function briefingComLegenda(texto, legenda){
  const linhas=String(texto||'').replace(/\r\n?/g,'\n').split('\n');
  const nova=String(legenda||'').replace(/\r\n?/g,'\n').replace(/^`{3,}/gm,"'''").trim();
  const ehTitulo=(l)=>typeof briefingEhTitulo==='function' ? briefingEhTitulo(l.replace(/^#+\s*/,'')) : /^[^a-zà-ÿ]{4,80}$/.test(l);
  const tituloLimpo=(l)=>typeof briefingTituloLimpo==='function' ? briefingTituloLimpo(l.replace(/^#+\s*/,'')) : l;
  let cerca=false, inicio=-1, fim=linhas.length, linhaSolta=-1;
  linhas.forEach((l, i)=>{
    const s=l.trim();
    if(/^`{3,}/.test(s)){ cerca=!cerca; return; }
    if(cerca || !s) return;
    if(ehTitulo(s)){
      if(inicio>=0 && fim===linhas.length && i>inicio) fim=i;
      else if(inicio<0 && /^legenda/i.test(tituloLimpo(s))) inicio=i;
      return;
    }
    if(inicio<0 && linhaSolta<0 && /^[-–—•*]?\s*legenda( do post)?\s*:\s*\S/i.test(s)) linhaSolta=i;
  });
  const bloco=nova ? ['```', nova, '```'] : [];
  let saida;
  if(inicio>=0) saida=nova ? [...linhas.slice(0, inicio+1), ...bloco, '', ...linhas.slice(fim)] : [...linhas.slice(0, inicio), ...linhas.slice(fim)];
  else {
    const corpo=(linhaSolta>=0 ? linhas.filter((_, i)=>i!==linhaSolta) : linhas).join('\n').trim();
    saida=nova ? [corpo, corpo ? '' : null, 'LEGENDA DO POST', ...bloco].filter((x)=>x!==null) : [corpo];
  }
  return saida.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function editarTextoDaConferencia(campo){
  const detail=DETALHE_DA_CONFERENCIA;
  if(!detail || (campo!=='legenda' && campo!=='briefing')) return;
  const destino=campo==='legenda' ? destinoDaLegendaDaConferencia(detail) : podeEditarBriefingDaConferencia(detail) ? 'briefing' : '';
  if(!destino) return;
  if(EDICAO_DA_CONFERENCIA) cancelarTextoDaConferencia();
  const corpo=document.getElementById(`vbc-${campo}-corpo`);
  if(!corpo) return;
  const atual=campo==='legenda' ? LEGENDA_DA_CONFERENCIA : briefingDaPecaNaConferencia(detail);
  EDICAO_DA_CONFERENCIA={ campo, destino, html:corpo.innerHTML };
  const b=document.getElementById(`vbc-${campo}-editar`); if(b) b.hidden=true;
  const onde=campo==='briefing' ? 'no briefing da peça' : destino==='planejamento' ? 'no planejamento aprovado (o cliente vê no VybeHub)' : 'na seção Legenda do briefing';
  corpo.innerHTML=`<div class="vbc-editor"><textarea id="vbc-campo" class="vbc-campo" rows="${campo==='briefing' ? 10 : 6}" aria-label="${campo==='briefing' ? 'Briefing da peça' : 'Legenda do post'}"></textarea>
    <div class="vbc-editor-acoes"><span class="vbc-editor-dica">Grava ${safeText(onde)} · Ctrl+Enter salva</span><button type="button" class="vbj-btn" onclick="cancelarTextoDaConferencia()">Cancelar</button><button type="button" id="vbc-campo-salvar" class="vbj-btn k" onclick="salvarTextoDaConferencia()">Salvar</button></div></div>`;
  const area=document.getElementById('vbc-campo');
  area.value=atual;
  area.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); salvarTextoDaConferencia(); }
    else if(e.key==='Escape'){ e.preventDefault(); e.stopPropagation(); cancelarTextoDaConferencia(); }
  });
  area.focus();
  area.setSelectionRange(area.value.length, area.value.length);
}
function cancelarTextoDaConferencia(){
  const ed=EDICAO_DA_CONFERENCIA;
  if(!ed) return;
  EDICAO_DA_CONFERENCIA=null;
  const corpo=document.getElementById(`vbc-${ed.campo}-corpo`); if(corpo) corpo.innerHTML=ed.html;
  const b=document.getElementById(`vbc-${ed.campo}-editar`); if(b) b.hidden=false;
}
async function gravarLegendaNoPlanejamento(itemId, legenda){
  const r=await fetch('/api/painel?area=planejamentos', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ acao:'legenda_da_peca', item:String(itemId), legenda:String(legenda ?? '') }) });
  const d=await r.json().catch(()=>({}));
  if(!r.ok || !d?.ok) throw new Error(d?.error || `Não foi possível salvar (${r.status}).`);
  return d;
}
async function salvarTextoDaConferencia(){
  const ed=EDICAO_DA_CONFERENCIA, detail=DETALHE_DA_CONFERENCIA;
  const area=document.getElementById('vbc-campo'), salvar=document.getElementById('vbc-campo-salvar');
  if(!ed || !detail || !area || salvar?.disabled) return;
  const texto=area.value.replace(/\r\n?/g,'\n').trim();
  const itemId=String(detail.id ?? pendingWorkflowChange?.item?.id ?? '');
  if(salvar){ salvar.disabled=true; salvar.textContent='Salvando…'; }
  try {
    if(ed.campo==='legenda' && ed.destino==='planejamento'){
      const d=await gravarLegendaNoPlanejamento(itemId, texto);
      detail.planejamento={ ...detail.planejamento, legenda:String(d.legenda ?? texto) };
    } else {
      const novo=ed.campo==='briefing' ? texto : briefingComLegenda(briefingDaPecaNaConferencia(detail), texto);
      const d=await gravarBriefing(itemId, novo);
      detail.briefing=String(d?.briefing ?? novo); detail.briefing_origem='cadastro';
    }
    // O histórico da peça leva a legenda nova (a nota segue o padrão "[Vybe OS · …]" das outras da conferência).
    if(ed.campo==='legenda') postItemUpdate(itemId, `[Vybe OS · Legenda editada na conferência]\n${texto || '(legenda apagada)'}`);
    EDICAO_DA_CONFERENCIA=null;
    if(DETALHE_DA_CONFERENCIA===detail) pintarTextosDaConferencia(detail);
    if(typeof showToast==='function') showToast(ed.campo==='legenda' ? 'Legenda salva.' : 'Briefing salvo.', 'ok', 3000);
  } catch(e){
    if(salvar){ salvar.disabled=false; salvar.textContent='Salvar'; }
    if(typeof showToast==='function') showToast(`Não foi possível salvar: ${e.message}`, 'err', 7000);
  }
}
function copiarLegendaDaConferencia(){
  if(!LEGENDA_DA_CONFERENCIA) return;
  if(typeof copiarBriefingTexto==='function') return copiarBriefingTexto(LEGENDA_DA_CONFERENCIA, 'Legenda');
  navigator.clipboard?.writeText(LEGENDA_DA_CONFERENCIA).catch(()=>{});
}
// Marcar (ou apontar) uma caixa acende o bloco que ela confere. Só a classe: nada muda no que a caixa registra.
function ligarAlvosDaConferencia(){
  const form=document.querySelector('#workflow-modal .vbc-checks');
  if(!form || form.dataset.alvos) return;
  form.dataset.alvos='1';
  const bloco=(label)=>document.getElementById({ peca:'vbc-bloco-peca', legenda:'vbc-legenda', briefing:'vbc-briefing' }[label?.dataset?.alvo]||'');
  const apontar=(e, on)=>{ const b=bloco(e.target?.closest?.('[data-alvo]')); if(b) b.classList.toggle('vbc-apontado', on); };
  form.addEventListener('mouseover', (e)=>apontar(e, true));
  form.addEventListener('mouseout', (e)=>apontar(e, false));
  form.addEventListener('focusin', (e)=>apontar(e, true));
  form.addEventListener('focusout', (e)=>apontar(e, false));
  form.addEventListener('change', (e)=>{
    const b=bloco(e.target?.closest?.('[data-alvo]'));
    if(!b || !e.target.checked) return;
    b.classList.remove('vbc-realce'); void b.offsetWidth; b.classList.add('vbc-realce');
    setTimeout(()=>b.classList.remove('vbc-realce'), 1400);
  });
}
function openMaterialReviewGate(item, option) {
  const scheduled = normalizedWorkflowStatus(option?.label) === 'agendado';
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option,
    titulo: scheduled ? 'Conferir antes de agendar' : 'Conferir antes de finalizar',
    sub: scheduled ? 'a peça só muda para Agendado depois da conferência' : 'confira o material postado ou entregue antes de encerrar',
    cab: scheduled ? 'Antes de liberar o agendamento' : 'Antes de marcar como finalizado',
    idForm: 'material-review-form', mudar: 'updateMaterialReviewState()', checks: materialReviewChecklistFor(item, option), marca: 'data-material-review-check',
    nota: scheduled ? 'A conferência fica no histórico da peça junto com a troca de status. Não é preciso justificar.'
      : 'A conferência fica no histórico da peça junto com a troca de status. Nenhuma justificativa é exigida para finalizar.',
    idBotao: 'material-review-submit', onclick: 'submitMaterialReview()', acao: scheduled ? 'Confirmar e agendar' : 'Confirmar e finalizar' }), 'vbc vbc-mesa');
  ligarFilaDaConferencia(item, option, 'material');
  loadMaterialReviewPreview(item.id);
  updateMaterialReviewState();
}
async function submitMaterialReview(){ const flow=pendingWorkflowChange; const checks=[...document.querySelectorAll('input[data-material-review-check]')]; if(!flow||!checks.length) return; if(checks.some(check=>!check.checked)) return showToast('Confirme a conferência visual antes de continuar.','info'); const button=document.getElementById('material-review-submit'); if(button){button.disabled=true;button.textContent='Registrando...';} try { const checked=checks.map(check=>check.parentElement.textContent.trim()).filter(Boolean); await postItemUpdate(flow.item.id,`[Vybe OS · Conferência final]\nEtapa: ${flow.item.status} → ${flow.option.label}\nMaterial conferido: ${checked.join(' | ')}`); const {item,option}=flow; const seguinte=proximaDaConferencia(); closeWorkflowModal(); oferecerProximaConferencia(seguinte, await commitStatusChange(item,option)); } catch(error){ if(button){button.disabled=false;button.textContent=normalizedWorkflowStatus(flow?.option?.label)==='agendado'?'Confirmar e agendar':'Confirmar e finalizar';} showToast(`Não foi possível registrar a conferência: ${error.message}`,'err',7000); } }
// ── conferencia visual ────────────────────────────────────────────────────────
// A arte ao lado, e duas saidas: voltar ou mandar. Sem campo obrigatorio, sem
// checklist, sem trava. Se a peca tiver mais de um arquivo, as setas do palco
// passam entre eles e o cabecalho diz "1 de N" — quem confere quer ver o que
// vai ser aprovado, nao so o primeiro. Mesma janela das outras conferencias
// (prancha V2-S-Conferir-Status), so que sem caixas: Confirmar ja nasce ligado.
function abrirConferenciaVisual(item, option) {
  pendingWorkflowChange = { item, option, manual: false };
  abrirJanelaV2(janelaDeConferenciaHtml({ item, option, titulo: 'Confira antes de mandar', sub: `a arte vai para ${option.label}`,
    cab: 'A arte que vai para aprovação', nota: 'Sem campo obrigatório: olhe a arte e confirme. A troca fica no histórico da peça.',
    idBotao: 'conferencia-confirmar', onclick: 'confirmarConferenciaVisual()', acao: 'Confirmar', desligado: false }), 'vbc vbc-mesa conferencia-visual');
  ligarFilaDaConferencia(item, option, 'visual');
  loadMaterialReviewPreview(item.id);
}

async function confirmarConferenciaVisual() {
  const fluxo = pendingWorkflowChange;
  if (!fluxo) return;
  const botao = document.getElementById('conferencia-confirmar');
  if (botao) { botao.disabled = true; botao.textContent = 'Mandando…'; }
  const { item, option } = fluxo;
  // A nota de historico nao segura a troca — a mesma regra de todos os portoes.
  void postItemUpdate(item.id, `[Vybe OS · Conferência visual]\nEtapa: ${item.status} → ${option.label}`);
  const seguinte = proximaDaConferencia();
  closeWorkflowModal();
  oferecerProximaConferencia(seguinte, await commitStatusChange(item, option));
}

// Uma pergunta por vez: o que ficou pronto vira botões que escrevem o
// "concluído", o próximo passo já vem sugerido pela etapa de destino e o link
// da entrega da peça entra sozinho quando existe. Os campos mantêm os ids que
// submitHandoff lê.
const BASTAO_PRONTOS = ['Arte final', 'Legenda revisada', 'Arquivo anexado', 'Aprovado internamente', 'Vídeo editado', 'Roteiro pronto'];
function facilitarPassagemDeBastao(item, option) {
  const feito = document.getElementById('handoff-done');
  const proximo = document.getElementById('handoff-next');
  const link = document.getElementById('handoff-link');
  if (!feito) return;
  feito.insertAdjacentHTML('beforebegin', `<div class="pv-sugestoes" id="handoff-prontos">${BASTAO_PRONTOS.map((p) => `<button type="button" onclick="alternarProntoDoBastao(this)">${safeText(p)}</button>`).join('')}</div>`);
  feito.rows = 2;
  if (proximo && !proximo.value && option?.label) proximo.value = `Segue para ${option.label}.`;
  const entrega = String(item?.link_entrega || item?.entrega_link || item?.link || '').trim();
  if (link && !link.value && /^https?:\/\//i.test(entrega)) link.value = entrega;
}
function alternarProntoDoBastao(botao) {
  botao.classList.toggle('on');
  const marcados = [...document.querySelectorAll('#handoff-prontos button.on')].map((b) => b.textContent);
  const feito = document.getElementById('handoff-done');
  if (feito) feito.value = marcados.join(' · ');
}
// Rodada S (frente e): a passagem de bastão na casca das janelas V2 (vbj, padrao-v2/s-b.css), como os portões da rodada
// R (prancha V2-R-Janelas-Temas): no vidro o nome do pedido, "1 de 3 · entregou" e o fechar; numa folha a peça com o
// de → para, as etapas com nome e a pergunta da vez; no pé, no vidro, os traços, "Nada muda até você confirmar." e os
// botões. Os ids que submitHandoff e passoDoBastao leem são os mesmos; o desenho mora em padrao-v2/s-e.css (vbb-*),
// só com tokens, e sai nos três temas.
const BASTAO_ETAPAS = ['Entregou', 'Próximo', 'Confirmar'];
function openHandoffGate(item, option=null) {
  pendingWorkflowChange={item,option,manual:!option};
  const target=option?.label || '';
  const formato=String(item.formato || item.tipo || '').trim();
  const html=`${vbjTopoHtml({ titulo: 'Passar o bastão', sub: `1 de ${BASTAO_ETAPAS.length} · ${BASTAO_ETAPAS[0].toLowerCase()}`, idTitulo: 'bastao-titulo' })}
<div class="vbb-folha">
<div class="vbc-peca vbb-peca">${vbjAvatarHtml(item.cliente)}<span class="vbc-peca-txt"><b>${safeText(item.nome || 'Sem título')}</b><span>${safeText([item.cliente || 'Cliente não informado', formato].filter(Boolean).join(' · '))}</span></span><span class="vbc-de-para">${vbjStatusHtml(item.status, item.status_color)}${item.status ? vbjIcone('dir', 14) : ''}${target && target !== item.status ? vbjStatusHtml(target, option?.color) : `<span class="vbb-alvo">${safeText(target || 'próxima pessoa ou etapa')}</span>`}</span></div>
<div class="vbb-etapas" aria-hidden="true">${BASTAO_ETAPAS.map((nome, i) => `<span data-bastao-passo="${i}"${i ? '' : ' class="atual"'}>${nome}</span>`).join('')}</div>
<div class="vbb-corpo">
<section data-bastao="0"><p class="vbb-q">O que você deixou pronto?</p><label class="vbb-campo"><span class="vbb-rot">Marque ou escreva</span><textarea id="handoff-done" rows="3" placeholder="Ex.: Arte revisada, versão final aprovada internamente e arquivo anexado."></textarea></label><label class="vbb-campo"><span class="vbb-rot">Link ou arquivo de referência (opcional)</span><input id="handoff-link" type="url" placeholder="https://drive.google.com/... ou link do arquivo"></label></section>
<section data-bastao="1" hidden><p class="vbb-q">O que precisa acontecer agora?</p><label class="vbb-campo"><span class="vbb-rot">O próximo passo, para quem pega</span><textarea id="handoff-next" rows="3" placeholder="Ex.: Tainara deve conferir a legenda e agendar para segunda-feira."></textarea></label></section>
<section data-bastao="2" hidden><p class="vbb-q">Confira antes de registrar</p><dl id="bastao-revisao" class="bastao-revisao vbb-revisao"></dl></section>
</div></div>
<div class="vbj-pe"><span class="vbj-passos"><span class="vbj-tracos" aria-hidden="true">${BASTAO_ETAPAS.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</span><span><span id="bastao-onde">1 de ${BASTAO_ETAPAS.length}</span> · nada muda até você confirmar.</span></span><button type="button" id="bastao-voltar" class="vbj-btn" onclick="passoDoBastao(-1)">Cancelar</button><button type="button" id="bastao-seguir" class="vbj-btn k" onclick="passoDoBastao(1)">Continuar</button></div>`;
  if (typeof abrirJanelaV2 === 'function') abrirJanelaV2(html, 'vbb'); else openWorkflowModal(html);
  facilitarPassagemDeBastao(item, option); BASTAO_FIM = `Registrar e ${option ? 'atualizar o status' : 'salvar'}`;
}
// Uma pergunta por vez (direção de arte): Entregou → Próximo → Confirmar. Os
// campos são os mesmos (submitHandoff lê handoff-done, handoff-next e
// handoff-link); só um passo fica à vista e o último mostra o resumo.
let BASTAO_FIM = 'Registrar';
function passoDoBastao(dir) {
  const modal = document.getElementById('workflow-modal'); if (!modal) return;
  const secoes = [...modal.querySelectorAll('[data-bastao]')];
  const atual = secoes.findIndex((x) => !x.hidden), ir = atual + dir;
  if (ir < 0) return closeWorkflowModal();
  if (ir >= secoes.length) return submitHandoff();
  secoes.forEach((x, i) => { x.hidden = i !== ir; });
  modal.querySelectorAll('[data-bastao-passo]').forEach((li) => { const n = Number(li.dataset.bastaoPasso); li.classList.toggle('atual', n === ir); li.classList.toggle('feito', n < ir); });
  const v = (id) => String(document.getElementById(id)?.value || '').trim();
  if (ir === secoes.length - 1) { const rev = document.getElementById('bastao-revisao'); if (rev) rev.innerHTML = [['Pronto', v('handoff-done')], ['Próximo passo', v('handoff-next')], ['Link', v('handoff-link')]].map(([k, x]) => `<div><dt>${k}</dt><dd>${safeText(x || '—')}</dd></div>`).join(''); }
  document.getElementById('bastao-onde').textContent = `${ir + 1} de ${secoes.length}`;
  modal.querySelectorAll('.vbj-tracos i').forEach((t, i) => t.classList.toggle('on', i <= ir));
  const sub = modal.classList.contains('vbb') ? modal.querySelector('.vbj-sub') : null;
  if (sub) sub.textContent = `${ir + 1} de ${secoes.length} · ${String(BASTAO_ETAPAS[ir] || '').toLowerCase()}`;
  document.getElementById('bastao-voltar').textContent = ir ? 'Voltar' : 'Cancelar';
  document.getElementById('bastao-seguir').textContent = ir === secoes.length - 1 ? BASTAO_FIM : 'Continuar';
  secoes[ir].querySelector('textarea,input')?.focus();
}
// A passagem de bastão leva a peça à etapa seguinte (Paulo, 16/11/2026: "de EM ANDAMENTO precisa ir PARA APROVAÇÃO...
// e de PARA APROVAÇÃO para PARA AGENDAR"). Antes o botão "Passar bastão" só registrava o comentário e a peça ficava
// onde estava. O mapa é por chave do rótulo (sem acento, minúsculas, '_'), a mesma de chaveDeStatus, para valer com
// "Para Aprovação" ou "Para aprovação". Status fora do mapa (ou destino que o quadro não tem) seguem como antes:
// só o registro, sem trocar o status.
const BASTAO_PROXIMA_ETAPA = Object.freeze({ em_andamento: 'para_aprovacao', para_aprovacao: 'para_agendar' });
const chaveDoBastao = (rotulo) => String(rotulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function destinoDoBastao(item) {
  const alvo = BASTAO_PROXIMA_ETAPA[chaveDoBastao(item?.status)];
  if (!alvo) return null;
  const opcoes = typeof operationalStatusOptions === 'function' ? (operationalStatusOptions(item) || []) : [];
  return opcoes.find((o) => o && o.ativa !== false && chaveDoBastao(o.label) === alvo) || null;
}
// Depois do registro, a troca passa pelos portões de sempre: Para aprovação pela conferência visual (updateFocusStatus);
// sair de Para aprovação é aprovar, e aprovar abre o checklist de qualidade, como o botão Aprovar da gaveta.
function seguirDepoisDoBastao(item, option) {
  if (chaveDoBastao(item?.status) === 'para_aprovacao' && typeof openQualityGate === 'function') return openQualityGate(item, option);
  return updateFocusStatus(String(item.id), option.label);
}
function openManualHandoff(itemId) { const item=findOperationalItem(itemId); if (!item) return; const destino=destinoDoBastao(item); openHandoffGate(item,destino); if (destino && pendingWorkflowChange) pendingWorkflowChange.bastao=true; }
