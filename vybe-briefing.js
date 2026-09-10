// vybe-briefing.js — o briefing da peça: de onde ele vem, como ele se divide e
// a tela que o mostra.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes. O arquivo de origem tinha 2.985 linhas e
// juntava risco, portões, prévia, gaveta, arquivos e isto aqui — seis assuntos
// que só se encontravam por acidente de vizinhança.
//
// Carrega DEPOIS de vybe-risco.js: as funções daqui leem DETALHE_DA_GAVETA, que
// é declarado lá.

// ─── O CONTEÚDO DA PEÇA ───────────────────────────────────────────────────────
//
// O briefing e a unica coisa que quem produz precisa ler, e era a mais escondida
// da gaveta: ficava no fim de "Todo o histórico", depois dos arquivos, da
// entrega, da memoria executiva. Quem ia executar rolava a gaveta inteira ate
// achar — e achava um paredao de texto corrido, com roteiro, legenda, stories e
// checklist todos grudados.
//
// Agora ele tem um botao no alto da gaveta, com o objetivo ja visivel antes do
// clique, e uma tela propria que separa o briefing nas partes que ele ja tem.
// O historico continua onde estava: isto aqui e um atalho, nao uma mudanca de
// lugar.
let BRIEFING_ABERTO = null;

// De onde vem o briefing. Sao duas origens reais: a coluna do banco (peca
// cadastrada pelo painel) e o corpo de um update (peca que veio do Monday, que e
// o caso da maioria). A busca no update procura o vocabulario do proprio modelo
// da casa e ignora os updates que o painel mesmo escreve.
function briefingDaPeca(detail) {
  const doBanco = String(detail?.briefing || '').trim();
  if (doBanco) return { texto: doBanco, autor: '', quando: detail?.created_at || '', origem: 'cadastro' };
  const marcas = /BRIEFING|CORA(Ç|C)(Ã|A)O DO PEDIDO|MENSAGEM ?\/ ?COPY|DIRE(Ç|C)(Ã|A)O DE ARTE|ROTEIRO|LEGENDA DO POST|STORIES DE APOIO|CHECKLIST|NOME DA TAREFA|HOOK/i;
  const candidatos = (detail?.updates || [])
    .map(update => ({ update, texto: workspacePlainText(update?.body || '') }))
    .filter(entrada => entrada.texto.length > 160)
    .filter(entrada => !/Vybe OS ·/.test(entrada.texto))
    .filter(entrada => marcas.test(entrada.texto));
  if (!candidatos.length) return null;
  // Briefing revisado vira update novo: o mais recente manda, e entre dois do
  // mesmo dia vale o mais completo.
  candidatos.sort((a, b) => String(b.update?.created_at || '').localeCompare(String(a.update?.created_at || ''))
                         || b.texto.length - a.texto.length);
  const escolhido = candidatos[0];
  return { texto: escolhido.texto, autor: escolhido.update?.creator?.name || '',
           quando: escolhido.update?.created_at || '', origem: 'histórico' };
}

// Titulo de secao no modelo da casa: "🎯 1. O CORAÇÃO DO PEDIDO". O que separa
// um titulo de uma linha comum e nao ter minuscula — mas "DIREÇÃO DE ARTE E
// AUDIOVISUAL (Instruções para a Fábrica)" tem, no parenteses de recado. Por
// isso o parenteses do fim sai antes da conta.
function briefingEhTitulo(linha) {
  const limpa = String(linha).replace(/^[\s#>*\-–—]+/, '')
    .replace(/^[\u{1F000}-\u{1FAFF}←-➿️‍]+\s*/u, '')
    .replace(/\s*\([^)]*\)\s*$/, '').replace(/[\s:.]+$/, '').trim();
  if (limpa.length < 4 || limpa.length > 80) return false;
  if (/[a-zà-ÿ]/.test(limpa.replace(/^\d+\.?\s*/, ''))) return false;
  return /[A-ZÀ-Þ]{3}/.test(limpa);
}
function briefingTituloLimpo(linha) {
  return String(linha).replace(/^[\s#>*\-–—]+/, '')
    .replace(/^[\u{1F000}-\u{1FAFF}←-➿️‍]+\s*/u, '')
    .replace(/^\d+\.?\s*/, '').replace(/[\s:]+$/, '').trim();
}

// O briefing chega como texto corrido. Aqui ele vira secoes, e dentro de cada
// uma as linhas ja se dizem o que sao: "Objetivo: ..." e um par rotulo/valor,
// "- Slide 1: ..." e um item de lista, "Story 1:" sozinho abre um sub-bloco.
function briefingEmSecoes(texto) {
  const secoes = []; let atual = null;
  const abrir = titulo => { atual = { titulo, linhas: [] }; secoes.push(atual); return atual; };

  // O TEXTO DA ARTE vem entre cercas (```), e cerca quer dizer "nao interprete
  // o que esta aqui dentro". O leitor nao sabia disso: mostrava a cerca como se
  // fosse conteudo — o time de design via um "```text" solto na tela — e ainda
  // lia o que estava dentro como se fosse estrutura do briefing. Foi assim que
  // "CHECKLIST PARA O / DIA DO ATENDIMENTO", que na arte sao duas linhas de um
  // titulo so, viraram duas secoes, a primeira vazia.
  //
  // Dentro da cerca nada e titulo, nada e par rotulo/valor, nada e item de
  // lista: e o texto que vai para a peca, com as quebras que ele tem.
  const brutas = String(texto).split('\n');
  let arte = null;
  for (const bruta of brutas) {
    const semEspaco = bruta.trim();

    if (/^`{3,}/.test(semEspaco)) {
      // Cerca sem par (briefing cortado no meio) fecha no fim do texto, la
      // embaixo — melhor um bloco a mais do que engolir o resto do briefing.
      if (arte) { arte = null; } else { if (!atual) abrir(''); arte = { tipo: 'arte', valor: '' }; atual.linhas.push(arte); }
      continue;
    }
    if (arte) { arte.valor += (arte.valor ? '\n' : '') + bruta.replace(/\s+$/, ''); continue; }

    if (!semEspaco) continue;
    // "Veiculação: 09/09 | Prazo: 07/09 | Formato: Carrossel" e uma linha so no
    // texto e tres informacoes na cabeca de quem le. Separadas, elas viram tres
    // pares e cabem no resumo do alto.
    const limpa = semEspaco.replace(/^#+\s*/, '');
    const partes = limpa.split(/\s+\|\s+/);
    const linhas = partes.length > 1 && partes.every(parte => /^[^:]{2,42}:\s*\S/.test(parte))
      ? partes : [limpa];

    for (const cru of linhas) {
      const linha = cru.trim();
      if (!linha) continue;
      if (briefingEhTitulo(linha)) { abrir(briefingTituloLimpo(linha)); continue; }
      if (!atual) abrir('');
      const marcador = /^[-–—•*]\s+/.test(linha);
      const corpo = linha.replace(/^[-–—•*]\s+/, '');
      const par = corpo.match(/^([^:]{2,42}):\s*(.*)$/);
      if (par && !par[2]) atual.linhas.push({ tipo: 'subtitulo', rotulo: par[1].trim() });
      else if (par) atual.linhas.push({ tipo: marcador ? 'item' : 'par', rotulo: par[1].trim(), valor: par[2].trim() });
      else atual.linhas.push({ tipo: marcador ? 'item' : 'texto', valor: corpo });
    }
  }

  // Bloco de arte que ficou vazio (duas cercas seguidas) nao vira caixa vazia.
  secoes.forEach(secao => { secao.linhas = secao.linhas.filter(l => l.tipo !== 'arte' || String(l.valor).trim()); });
  secoes.forEach(secao => { secao.linhas.forEach(l => { if (l.tipo === 'arte') l.valor = String(l.valor).replace(/^\n+|\n+$/g, ''); }); });
  return secoes.filter(secao => secao.titulo || secao.linhas.length);
}

// O que aparece sem precisar abrir: o objetivo, ou o gancho, ou a primeira frase
// que exista. Antes disso a gaveta nao dizia nada sobre o conteudo da peca.
function briefingChamada(secoes) {
  const todas = secoes.flatMap(secao => secao.linhas);
  const preferido = ['objetivo', 'hook', 'público-alvo', 'publico-alvo', 'oferta/diferencial'];
  for (const chave of preferido) {
    const achou = todas.find(l => l.valor && String(l.rotulo || '').toLowerCase().replace(/\s*\(.*\)$/, '').startsWith(chave));
    if (achou) return `${achou.rotulo}: ${achou.valor}`;
  }
  const primeira = todas.find(l => l.valor && l.valor.length > 24);
  return primeira ? (primeira.rotulo ? `${primeira.rotulo}: ${primeira.valor}` : primeira.valor) : '';
}
function briefingResumoRapido(secoes) {
  const todas = secoes.flatMap(secao => secao.linhas).filter(l => l.valor);
  const quero = ['CTA', 'Formato', 'Público-Alvo', 'Publico-Alvo', 'Hook'];
  const vistos = new Set(); const fora = [];
  for (const alvo of quero) {
    const achou = todas.find(l => String(l.rotulo || '').toLowerCase().replace(/\s*\(.*\)$/, '').trim() === alvo.toLowerCase());
    if (!achou || vistos.has(alvo.toLowerCase())) continue;
    vistos.add(alvo.toLowerCase());
    fora.push({ rotulo: alvo === 'Hook' ? 'Gancho' : alvo, valor: achou.valor });
  }
  return fora.slice(0, 3);
}

// O botao no alto da gaveta. Sem briefing ele nao aparece: um botao que so sabe
// dizer "nao tem nada" e ruido em toda peca que ainda nao foi briefada.
function blocoDoBriefingHtml(detail, item) {
  const briefing = briefingDaPeca(detail);
  if (!briefing) return '';
  const secoes = briefingEmSecoes(briefing.texto);
  const chamada = briefingChamada(secoes);
  const partes = secoes.filter(secao => secao.titulo).length;
  return `<div class="brief-atalho">
    <button type="button" class="brief-abrir" onclick="abrirBriefing('${safeText(String(item.id))}')">
      <span class="brief-abrir-icone">📄</span>
      <span class="brief-abrir-copy"><b>Ver conteúdo</b><small>${partes ? `${partes} parte${partes === 1 ? '' : 's'} · ` : ''}briefing de produção${briefing.origem === 'histórico' ? ' · do histórico' : ''}</small></span>
      <span class="brief-abrir-seta">→</span>
    </button>
    ${chamada ? `<p class="brief-chamada">${safeText(chamada.slice(0, 190))}${chamada.length > 190 ? '…' : ''}</p>` : ''}
  </div>`;
}

function briefingLinhaHtml(linha) {
  if (linha.tipo === 'arte') {
    return `<div class="brief-arte"><span class="brief-arte-selo">texto da arte</span>
      <pre>${safeText(linha.valor)}</pre></div>`;
  }
  if (linha.tipo === 'subtitulo') return `<div class="brief-subtitulo">${safeText(linha.rotulo)}</div>`;
  if (linha.tipo === 'par') return `<div class="brief-par"><span>${safeText(linha.rotulo)}</span><p>${safeText(linha.valor)}</p></div>`;
  if (linha.tipo === 'item') return `<div class="brief-item">${linha.rotulo ? `<b>${safeText(linha.rotulo)}</b> ` : ''}${safeText(linha.valor || '')}</div>`;
  return `<p class="brief-texto">${safeText(linha.valor || '')}</p>`;
}
function briefingSecaoTexto(secao) {
  // O texto da arte sai como esta: quem copia vai colar na peca, e a quebra de
  // linha dele e parte do que foi escrito.
  return [secao.titulo, ...secao.linhas.map(l => l.tipo === 'arte' ? String(l.valor || '')
    : l.tipo === 'subtitulo' ? `${l.rotulo}:`
    : l.rotulo ? `${l.rotulo}: ${l.valor}` : String(l.valor || ''))].filter(Boolean).join('\n');
}
function briefingSecaoHtml(secao, indice) {
  // Quando a secao ja se chama "TEXTO DA ARTE", o selo dentro do bloco repete o
  // titulo logo acima dele. O selo existe para o bloco que aparece no meio de
  // outra secao, onde ninguem diria de onde ele saiu.
  const dizSozinha = /\bARTE\b/i.test(String(secao.titulo || ''));
  return `<article class="brief-secao${dizSozinha ? ' brief-secao-arte' : ''}">
    <div class="brief-secao-topo"><h3>${safeText(secao.titulo || 'Abertura')}</h3>
      <button type="button" class="brief-copiar" onclick="copiarParteDoBriefing(${indice})">Copiar</button></div>
    <div class="brief-secao-corpo">${secao.linhas.map(briefingLinhaHtml).join('')}</div>
  </article>`;
}

// Chamado de dois lugares: de dentro da gaveta, que ja tem o contexto na mao, e
// da linha da fila, que nao tem nada. Quem executa nao devia precisar abrir a
// peca inteira para ler o briefing dela — entao aqui ele busca quando falta.
async function abrirBriefing(itemId, gatilho) {
  let detail = DETALHE_DA_GAVETA;
  const jaEDesta = detail && String(detail.id ?? '') === String(itemId);
  if (!jaEDesta) {
    if (gatilho) { gatilho.disabled = true; gatilho.classList.add('carregando'); }
    try { detail = await fetchWorkspaceItem(itemId); }
    catch (erro) { showToast(`Não foi possível abrir o briefing: ${erro.message}`, 'err', 7000); return; }
    finally { if (gatilho) { gatilho.disabled = false; gatilho.classList.remove('carregando'); } }
  }
  const item = findOperationalItem(itemId)
    || (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []).find(d => String(d.id) === String(itemId))
    || { id: itemId, nome: detail?.name || 'Atividade', cliente: '' };
  const briefing = detail ? briefingDaPeca(detail) : null;
  if (!briefing) return showToast('Esta atividade ainda não tem briefing registrado.', 'info');
  const secoes = briefingEmSecoes(briefing.texto);
  BRIEFING_ABERTO = { secoes, texto: briefing.texto, item };
  const resumo = briefingResumoRapido(secoes);
  const quando = String(briefing.quando || '').replace('T', ' ').slice(0, 16);
  document.getElementById('brief-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'brief-overlay'; overlay.className = 'brief-overlay';
  overlay.onclick = event => { if (event.target === overlay) fecharBriefing(); };
  overlay.innerHTML = `<div class="brief-folha" role="dialog" aria-label="Conteúdo da atividade">
    <div class="brief-topo">
      <div class="brief-topo-copy">
        <span class="brief-kicker">Conteúdo para produção${briefing.origem === 'histórico' ? ' · registrado no histórico' : ''}${quando ? ` · ${safeText(quando)}` : ''}</span>
        <h2>${safeText(item.nome || detail?.name || 'Atividade')}</h2>
        <small>${safeText(item.cliente || 'Cliente não informado')}${item.formato ? ` · ${safeText(item.formato)}` : ''}${item.veiculacao_iso ? ` · veicula ${safeText(typeof planningDateBr === 'function' ? planningDateBr(item.veiculacao_iso) : item.veiculacao_iso)}` : ''}</small>
      </div>
      <div class="brief-topo-acoes">
        <button type="button" class="brief-copiar" onclick="copiarBriefingInteiro()">Copiar tudo</button>
        <button type="button" class="brief-fechar" onclick="fecharBriefing()" aria-label="Fechar">×</button>
      </div>
    </div>
    ${faixaDeMaterialBrutoHtml(detail, item)}
    ${resumo.length ? `<div class="brief-resumo">${resumo.map(r => `<div><span>${safeText(r.rotulo)}</span><b>${safeText(r.valor)}</b></div>`).join('')}</div>` : ''}
    <div class="brief-corpo">${secoes.map(briefingSecaoHtml).join('')}</div>
  </div>`;
  document.body.appendChild(overlay);
}
function fecharBriefing() { document.getElementById('brief-overlay')?.remove(); BRIEFING_ABERTO = null; }
async function copiarBriefingTexto(texto, rotulo) {
  try { await navigator.clipboard.writeText(String(texto)); showToast(`✓ ${rotulo} copiado`, 'ok', 2500); }
  catch { showToast('O navegador não deixou copiar. Selecione o texto na tela.', 'info', 5000); }
}
function copiarParteDoBriefing(indice) {
  const secao = BRIEFING_ABERTO?.secoes?.[indice];
  if (secao) copiarBriefingTexto(briefingSecaoTexto(secao), secao.titulo || 'Trecho');
}
function copiarBriefingInteiro() {
  if (BRIEFING_ABERTO?.texto) copiarBriefingTexto(BRIEFING_ABERTO.texto, 'Briefing');
}
