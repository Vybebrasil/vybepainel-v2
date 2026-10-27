// vybe-material.js — a arte da peça: ver em tamanho real, baixar, trocar, e o
// material bruto que a origina.
//
// Extraído de vybe-risco.js sem uma linha de mudança: mesmo escopo global, mesma
// ordem de carregamento, mesmos nomes. São dois blocos que estavam a trezentas
// linhas de distância um do outro no arquivo antigo, tratando do mesmo assunto —
// o que entra na peça e o que sai dela.
//
// Carrega DEPOIS de vybe-risco.js: as funções daqui leem DETALHE_DA_GAVETA e
// activeWorkspaceAssets e chamam workspaceDeliveryInfo, declarados lá.

let PREVIA_MATERIAL=[];
// Painel flutuante para conferir a arte em tamanho de verdade. Dentro do modal a
// imagem cabe em 38% da altura da tela, o que serve para reconhecer a peça mas
// não para conferir texto pequeno — e conferir é justamente o que se pede ali.
let PREVIA_GRANDE_INDICE = 0;
// De qual peca e a previa aberta. Vazio quando ela vem de um portao, onde a
// pergunta e "esta certo?" e nao "quero trocar isto".
let PREVIA_DA_PECA = '';
function trocarMaterialDaPrevia(event) {
  const id = PREVIA_DA_PECA;
  if (!id) return;
  fecharPreviaGrande();
  abrirEntregaRapida(id, event);
}

// ── PEÇA A PEÇA: CONFERIR UMA COLUNA INTEIRA SEM FECHAR A PRÉVIA ─────────────
//
// Paulo, 26/10/2026: os heads abrem a prévia para conferir o dia, e fechar e
// abrir de novo a cada peça é o que cansa. A prévia guarda a sequência de onde
// o olho foi clicado (a coluna do dia, a célula do calendário, o grupo da
// tabela) e anda por ela.
//
// "Se liga pra quando for peça estilo carrossel, pra não sair pulando": as
// setas do lado da imagem (e ← →) continuam passando as lâminas da MESMA peça
// e dão a volta nela. Trocar de peça é outro controle, em cima ("Peça
// anterior" / "Próxima peça", ↑ ↓), e sempre começa da primeira lâmina.
let PREVIA_SEQUENCIA = { ids: [], rotulo: '', indice: 0 };
// A peça aberta: nome e cliente para a barra, e o estado do que veio do servidor.
let PREVIA_PECA = null;
const PREVIA_DETALHES = new Map();
let PREVIA_PECA_VEZ = 0;

// A sequência é o que está na tela em volta do clique: os olhos do mesmo
// [data-previa-sequencia]. A célula do calendário mostra só cinco peças, então
// ela traz a lista completa do dia em data-previa-ids.
function sequenciaDaPrevia(itemId, ancora) {
  const id = String(itemId);
  const caixa = ancora?.closest?.('[data-previa-sequencia]');
  if (!caixa) return { ids: [id], rotulo: '', indice: 0 };
  const lista = caixa.dataset.previaIds
    ? caixa.dataset.previaIds.split(',')
    : [...caixa.querySelectorAll('[data-previa-id]')].map((b) => b.dataset.previaId);
  const ids = [...new Set(lista.filter(Boolean))];
  if (!ids.includes(id)) ids.unshift(id);
  return { ids, rotulo: caixa.dataset.previaSequencia || '', indice: ids.indexOf(id) };
}

function pecaLocalDaPrevia(id) {
  const conteudo = typeof findOperationalItem === 'function' ? findOperationalItem(id) : null;
  if (conteudo) return conteudo;
  const pedido = (typeof DADOS_DEMANDAS !== 'undefined' ? DADOS_DEMANDAS : []).find((d) => String(d.id) === id);
  return pedido && typeof normalizeRequestForOperational === 'function' ? normalizeRequestForOperational(pedido) : pedido;
}

// Uma busca por peça enquanto a prévia está aberta: voltar uma peça é na hora.
function detalheDaPrevia(id) {
  if (!PREVIA_DETALHES.has(id)) {
    PREVIA_DETALHES.set(id, fetchWorkspaceItem(id).catch((erro) => { PREVIA_DETALHES.delete(id); throw erro; }));
  }
  return PREVIA_DETALHES.get(id);
}

async function abrirPecaNaPrevia(id, sequencia) {
  PREVIA_SEQUENCIA = sequencia || { ids: [id], rotulo: '', indice: 0 };
  await mostrarPecaDaPrevia(Math.max(0, PREVIA_SEQUENCIA.ids.indexOf(id)));
}

async function mostrarPecaDaPrevia(indice) {
  const id = PREVIA_SEQUENCIA.ids[indice];
  if (!id) return;
  const vez = ++PREVIA_PECA_VEZ;
  PREVIA_SEQUENCIA.indice = indice;
  const local = pecaLocalDaPrevia(id);
  PREVIA_PECA = { id, nome: local?.nome || '', cliente: local?.cliente || '', link: '', estado: 'carregando', erro: '' };
  PREVIA_DA_PECA = id;
  PREVIA_MATERIAL = [];
  abrirPreviaGrande(0);
  try {
    const detalhe = await detalheDaPrevia(id);
    if (vez !== PREVIA_PECA_VEZ) return;
    PREVIA_MATERIAL = materialDaPeca(detalhe, local);
    // Sem imagem, pode haver link — e o link e material tanto quanto o arquivo.
    const entrega = !PREVIA_MATERIAL.length && typeof workspaceDeliveryInfo === 'function' ? workspaceDeliveryInfo(detalhe) : null;
    PREVIA_PECA.link = entrega?.url || '';
    PREVIA_PECA.estado = 'pronta';
  } catch (erro) {
    if (vez !== PREVIA_PECA_VEZ) return;
    PREVIA_PECA.estado = 'erro';
    PREVIA_PECA.erro = erro.message || 'Falha ao buscar a peça.';
  }
  abrirPreviaGrande(0);
  // A próxima já vem buscada: quem confere uma coluna anda para a frente.
  const proxima = PREVIA_SEQUENCIA.ids[indice + 1];
  if (proxima) detalheDaPrevia(proxima).catch(() => {});
}

function passarPecaDaPrevia(passo) {
  const total = PREVIA_SEQUENCIA.ids.length;
  if (!PREVIA_PECA || total < 2) return;
  const destino = PREVIA_SEQUENCIA.indice + passo;
  if (destino < 0 || destino >= total) return;
  mostrarPecaDaPrevia(destino);
}

function abrirPreviaGrande(indice = 0) {
  if (!PREVIA_MATERIAL.length && !PREVIA_PECA) return;
  PREVIA_GRANDE_INDICE = Math.max(0, Math.min(indice, PREVIA_MATERIAL.length - 1));
  let caixa = document.getElementById('previa-grande');
  if (!caixa) {
    caixa = document.createElement('div');
    caixa.id = 'previa-grande';
    caixa.className = 'previa-grande';
    caixa.innerHTML = `
      <div class="previa-grande-vidro">
        <div class="previa-grande-topo">
          <span id="previa-grande-nome"></span>
          <button type="button" id="previa-baixar" class="previa-grande-baixar"
            onclick="baixarDaPrevia(event)">↓ Baixar</button>
          <button type="button" id="previa-trocar" class="previa-grande-trocar"
            onclick="trocarMaterialDaPrevia(event)">⤓ Trocar material</button>
          <button class="x-fechar" type="button" onclick="fecharPreviaGrande()" aria-label="Fechar">✕</button>
        </div>
        <div class="previa-grande-pecas" id="previa-grande-pecas" role="group" aria-label="Peças da sequência">
          <button type="button" class="previa-peca-passo" id="previa-peca-antes" onclick="passarPecaDaPrevia(-1)"
            title="Peça anterior (↑)" aria-label="Peça anterior">‹<span> Peça anterior</span></button>
          <div class="previa-peca-info" aria-live="polite"><b id="previa-peca-nome"></b><small id="previa-peca-onde"></small></div>
          <button type="button" class="previa-peca-passo" id="previa-peca-depois" onclick="passarPecaDaPrevia(1)"
            title="Próxima peça (↓)" aria-label="Próxima peça"><span>Próxima peça </span>›</button>
        </div>
        <div class="previa-grande-palco">
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(-1)" aria-label="Anterior">❮</button>
          <div id="previa-grande-media" class="previa-grande-media"></div>
          <button type="button" class="previa-grande-seta" onclick="passarPreviaGrande(1)" aria-label="Próxima">❯</button>
        </div>
      </div>`;
    document.body.appendChild(caixa);
    // Clicar fora fecha; dentro, não — senão fecha ao tentar arrastar a imagem.
    caixa.addEventListener('click', (e) => { if (e.target === caixa) fecharPreviaGrande(); });
    document.addEventListener('keydown', teclaPreviaGrande);
  }
  caixa.style.display = 'flex';
  pintarPreviaGrande();
}

function eVideoDoMaterial(a) {
  if (a?.tipo === 'video') return true;
  if (/^\.?(mp4|mov|webm|m4v|avi|mkv)$/i.test(String(a?.file_extension || ''))) return true;
  const onde = a?.name || a?.public_url || a?.url || '';
  return /\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(String(onde));
}

// ── VÍDEO NO OLHO (Paulo, 27/10/2026: "tem peça que é Reels, como os vídeos
// da VOA, mas no olhinho só aparece a capa… quero dar pra assistir; quando
// tiver capa, avisa que é capa e mostra o vídeo também") ────────────────────
//
// O que acontecia: a prévia só aceitava imagem. Arquivo do Drive chega com a
// miniatura do Drive — de um vídeo, é o primeiro quadro, a capa —, e o vídeo
// do Reels quase sempre entra como link de entrega (passa do limite do
// upload), que só era usado quando não havia imagem nenhuma.
//
// Agora o vídeo vem primeiro e toca no player do Drive (o servidor já deixa
// público o arquivo da prévia); link de pasta vira "Abrir o vídeo". Numa peça
// de vídeo, a imagem ganha a etiqueta "Capa".
function idDoDrive(url) {
  const u = String(url || '');
  return (u.match(/drive\.google\.com\/(?:file\/d\/|thumbnail\?id=|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{10,})/i) || [])[1] || '';
}
function idDoYoutube(url) {
  return (String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i) || [])[1] || '';
}
// Como tocar um vídeo: o player do Drive, do YouTube ou o próprio arquivo.
function fonteDoVideo(a) {
  const drive = idDoDrive(a?.link_drive) || idDoDrive(a?.public_url || a?.url) || idDoDrive(a?.abrir);
  if (drive) return { embed: `https://drive.google.com/file/d/${drive}/preview`, abrir: `https://drive.google.com/file/d/${drive}/view` };
  const yt = idDoYoutube(a?.abrir || a?.url);
  if (yt) return { embed: `https://www.youtube.com/embed/${yt}`, abrir: a.abrir || a.url };
  const direto = a?.public_url || a?.url || a?.abrir || '';
  return /\.(mp4|mov|webm|m4v)(?:$|[?#])/i.test(direto) ? { src: direto, abrir: direto } : { abrir: a?.abrir || direto };
}
function materialDaPeca(detalhe, local) {
  const todos = [...(detalhe?.assets || []), ...(detalhe?.updates || []).flatMap((u) => u?.assets || [])];
  const videos = todos.filter(eVideoDoMaterial).map((a) => ({ ...a, tipo: 'video' }));
  const imagens = (statusContextPreviewAssets(detalhe) || []).filter((a) => !eVideoDoMaterial(a));
  // O link de entrega marcado ("Link de entrega", "Link final") — não o
  // primeiro arquivo, que workspaceDeliveryInfo também devolve.
  const entrega = typeof workspaceDeliveryInfo === 'function' ? workspaceDeliveryInfo(detalhe) : null;
  const link = entrega?.source === 'Atualização de entrega' ? entrega.url : '';
  const formatoDeVideo = /reels|v[ií]deo|audiovisual|motion/i.test(String(local?.formato || local?.tipo || detalhe?.formato || ''));
  if (link && !videos.some((v) => fonteDoVideo(v).abrir === fonteDoVideo({ abrir: link }).abrir)) {
    const f = fonteDoVideo({ abrir: link });
    if (f.embed || f.src) videos.unshift({ tipo: 'video', name: 'Vídeo · link de entrega', abrir: link });
    else if (formatoDeVideo || videos.length) videos.unshift({ tipo: 'link', name: 'Vídeo · link de entrega', abrir: link });
  }
  const ehVideo = formatoDeVideo || videos.length > 0;
  const comCapa = imagens.map((a) => (ehVideo || /capa|cover|thumb/i.test(String(a.name || '')) ? { ...a, capa: true } : a));
  return [...videos, ...comCapa];
}
function capaDaPrevia(a) {
  const semVideo = !PREVIA_MATERIAL.some((m) => m.tipo === 'video' || m.tipo === 'link');
  return `<div class="previa-capa"><img id="previa-grande-img" src="${safeText(a.public_url || a.url || a.url_thumbnail || '')}" alt="Capa: ${safeText(a.name || '')}">
    <span class="previa-capa-selo">Capa</span>${semVideo ? '<small class="previa-capa-aviso">Esta é só a capa. O vídeo ainda não foi anexado nem registrado como link de entrega.</small>' : ''}</div>`;
}
function videoDaPrevia(a) {
  if (a.tipo === 'link') return `<div class="previa-grande-estado">${vbEstadoHtml({ titulo: 'O vídeo está num link', texto: 'O link não é de um arquivo que dá para tocar aqui (por exemplo, uma pasta). Ele abre numa aba nova.',
    acao: `<a class="vb-botao principal" href="${safeText(a.abrir)}" target="_blank" rel="noopener">Abrir o vídeo ↗</a>` })}</div>`;
  const f = fonteDoVideo(a);
  const player = f.embed
    ? `<iframe id="previa-grande-img" src="${safeText(f.embed)}" title="${safeText(a.name || 'Vídeo da peça')}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : f.src ? `<video id="previa-grande-img" src="${safeText(f.src)}" controls autoplay playsinline></video>` : '';
  if (!player) return videoDaPrevia({ ...a, tipo: 'link' });
  return `<div class="previa-video">${player}${f.abrir ? `<a class="previa-video-abrir" href="${safeText(f.abrir)}" target="_blank" rel="noopener">Abrir em outra aba ↗</a>` : ''}</div>`;
}

// A barra das peças só existe quando a prévia é de uma peça do painel; vinda de
// um portão ou da lista de arquivos ela some.
function pintarPecasDaPrevia() {
  const barra = document.getElementById('previa-grande-pecas');
  if (!barra) return;
  barra.hidden = !PREVIA_PECA;
  if (!PREVIA_PECA) return;
  const { ids, indice, rotulo } = PREVIA_SEQUENCIA;
  const nome = document.getElementById('previa-peca-nome');
  const onde = document.getElementById('previa-peca-onde');
  if (nome) nome.textContent = PREVIA_PECA.nome || 'Peça sem título';
  if (onde) onde.textContent = [PREVIA_PECA.cliente, rotulo,
    ids.length > 1 ? `peça ${indice + 1} de ${ids.length}` : ''].filter(Boolean).join(' · ');
  const antes = document.getElementById('previa-peca-antes');
  const depois = document.getElementById('previa-peca-depois');
  if (antes) { antes.hidden = ids.length < 2; antes.disabled = indice <= 0; }
  if (depois) { depois.hidden = ids.length < 2; depois.disabled = indice >= ids.length - 1; }
}

// Peça sem imagem: carregando, erro, só link ou nada registrado. Nenhum dos
// quatro é um beco — cada um diz o que fazer dali.
function estadoDaPecaNaPrevia() {
  const p = PREVIA_PECA;
  if (p.estado === 'carregando') return vbEstadoHtml({ tipo: 'carregando', titulo: 'Carregando a peça' });
  if (p.estado === 'erro') return vbEstadoHtml({ tipo: 'erro', titulo: 'Não foi possível abrir esta peça', texto: p.erro,
    acao: `<button type="button" class="vb-botao" onclick="mostrarPecaDaPrevia(PREVIA_SEQUENCIA.indice)">Tentar de novo</button>` });
  if (p.link) return vbEstadoHtml({ titulo: 'O material desta peça é um link', texto: 'Ele abre numa aba nova.',
    acao: `<a class="vb-botao principal" href="${safeText(p.link)}" target="_blank" rel="noopener">Abrir o link</a>` });
  return vbEstadoHtml({ titulo: 'Sem arquivo nem link registrado',
    texto: 'A peça está marcada como entregue, mas o material não foi anexado.',
    acao: `<button type="button" class="vb-botao" onclick="trocarMaterialDaPrevia(event)">Entregar material</button>` });
}

function pintarPreviaGrande() {
  pintarPecasDaPrevia();
  const a = PREVIA_MATERIAL[PREVIA_GRANDE_INDICE];
  const palco = document.getElementById('previa-grande-media');
  const nome = document.getElementById('previa-grande-nome');
  if (!a) {
    if (!PREVIA_PECA) return;
    if (palco) palco.innerHTML = `<div class="previa-grande-estado">${estadoDaPecaNaPrevia()}</div>`;
    if (nome) nome.textContent = '';
    ['previa-baixar', 'previa-trocar'].forEach((idBotao) => {
      const b = document.getElementById(idBotao);
      if (b) b.style.display = 'none';
    });
    document.querySelectorAll('.previa-grande-seta').forEach((b) => { b.style.visibility = 'hidden'; });
    return;
  }
  // Video tinha caixa propria antes. Agora e a mesma caixa: quem abre um .mp4
  // pela lista de arquivos ganha as setas, o nome e o botao de baixar junto.
  if (palco) {
    const fonte = safeText(a.public_url || a.url || a.url_thumbnail || '');
    palco.innerHTML = eVideoDoMaterial(a) || a.tipo === 'link' ? videoDaPrevia(a)
      : a.capa ? capaDaPrevia(a)
      : `<img id="previa-grande-img" src="${fonte}" alt="${safeText(a.name || '')}">`;
  }
  if (nome) nome.textContent = `(${PREVIA_GRANDE_INDICE + 1}/${PREVIA_MATERIAL.length}) ${a.tipo === 'video' || a.tipo === 'link' ? '▶ ' : a.capa ? 'Capa · ' : ''}${a.name || ''}`;
  // Baixar precisa do id do arquivo no banco: e por ele que o servidor acha os
  // bytes. Previa de coisa que nao esta na peca (um link colado, por exemplo)
  // nao tem esse id, e o botao nao aparece em vez de aparecer quebrado.
  const baixar = document.getElementById('previa-baixar');
  if (baixar) baixar.style.display = a.local_id ? '' : 'none';
  // "Trocar material" so aparece quando se sabe de qual peca e a previa — ela
  // tambem abre de dentro de portoes, onde trocar o arquivo nao faz sentido.
  const trocar = document.getElementById('previa-trocar');
  if (trocar) trocar.style.display = PREVIA_DA_PECA ? '' : 'none';
  document.querySelectorAll('.previa-grande-seta').forEach((b) => {
    b.style.visibility = PREVIA_MATERIAL.length > 1 ? 'visible' : 'hidden';
  });
}

function passarPreviaGrande(passo) {
  if (!PREVIA_MATERIAL.length) return;
  PREVIA_GRANDE_INDICE = (PREVIA_GRANDE_INDICE + passo + PREVIA_MATERIAL.length) % PREVIA_MATERIAL.length;
  pintarPreviaGrande();
  trocarPreviaMaterial(PREVIA_GRANDE_INDICE);
}

// O navegador ignora o atributo `download` num link de outro dominio: ele abre
// a imagem em vez de salvar. Por isso o download passa pelo painel, que devolve
// os bytes com Content-Disposition: attachment — mesma origem, salva de verdade.
function baixarDaPrevia(evento) {
  evento?.stopPropagation?.();
  const a = PREVIA_MATERIAL[PREVIA_GRANDE_INDICE];
  if (!a?.local_id) return showToast('Este arquivo não tem cópia guardada para baixar.', 'info', 6000);
  const link = document.createElement('a');
  link.href = `/api/painel?area=baixar&arquivo=${encodeURIComponent(a.local_id)}`;
  link.download = a.name || '';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

// Havia DUAS caixas de prévia no painel: esta e uma escrita solta no index.html,
// com outro visual e sem "trocar material". A dos arquivos da gaveta chamava a
// outra. Agora e uma so, e este e o nome que os arquivos ja chamavam.
function openVybeLightbox(src, name) {
  const todos = (typeof activeWorkspaceAssets !== 'undefined' && activeWorkspaceAssets) || [];
  const mostraveis = todos.filter((a) => a?.url_thumbnail || eVideoDoMaterial(a)
    || /\.(png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(String(a?.name || a?.public_url || a?.url || '')));
  const mesmo = (a) => (a.public_url || a.url || '') === src || (a.name && a.name === name);
  // Sem a lista da peça — ou com um arquivo que não está nela — abre só ele.
  PREVIA_MATERIAL = mostraveis.some(mesmo) ? mostraveis : [{ name, url: src, public_url: src }];
  PREVIA_DA_PECA = '';
  PREVIA_PECA = null;
  const onde = Math.max(0, PREVIA_MATERIAL.findIndex(mesmo));
  abrirPreviaGrande(onde);
}

function fecharPreviaGrande() {
  const caixa = document.getElementById('previa-grande');
  if (caixa) caixa.style.display = 'none';
  // Um vídeo continuaria tocando atrás do painel fechado.
  caixa?.querySelector('video')?.pause();
  // A sequência é da abertura; um portão que abra a prévia depois não herda.
  PREVIA_PECA = null;
  PREVIA_SEQUENCIA = { ids: [], rotulo: '', indice: 0 };
  PREVIA_DETALHES.clear();
  PREVIA_PECA_VEZ++;
}

// Só responde às teclas com o painel aberto: ESC dentro do modal de checklist
// continua fechando o checklist, não a imagem.
function teclaPreviaGrande(e) {
  const caixa = document.getElementById('previa-grande');
  if (!caixa || caixa.style.display === 'none') return;
  if (e.key === 'Escape') { e.stopPropagation(); fecharPreviaGrande(); }
  if (e.key === 'ArrowLeft') passarPreviaGrande(-1);
  if (e.key === 'ArrowRight') passarPreviaGrande(1);
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); passarPecaDaPrevia(-1); }
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); passarPecaDaPrevia(1); }
}

function trocarPreviaMaterial(indice){ const asset=PREVIA_MATERIAL[indice]; if(!asset) return; PREVIA_GRANDE_INDICE=indice; const img=document.getElementById('material-review-img'); const legenda=document.getElementById('material-review-caption'); if(img){ img.src=asset.url_thumbnail||asset.public_url||asset.url||''; img.alt=`Prévia de ${asset.name||'material'}`; } if(legenda) legenda.textContent=`(${indice+1}/${PREVIA_MATERIAL.length}) ${asset.name||''}`; document.querySelectorAll('#material-review-strip button').forEach((b,i)=>b.classList.toggle('ativa',i===indice)); }

// ── O MATERIAL BRUTO: O CAMINHO DE ENTRADA ───────────────────────────────────
//
// A entrega, logo acima, e o que SAI da peca. Faltava o que ENTRA nela: os
// videos captados que quem edita precisa baixar antes de comecar.
//
// O sintoma foi um Reels com roteiro completo e nenhum arquivo: o link da pasta
// tinha sido colado numa atualizacao solta, e a tela de briefing — a unica que o
// editor abre — nao mostra atualizacao nenhuma. O material existia e ele nao
// achava. Nao era falta de registro, era falta de LUGAR para registrar.
//
// Agora tem campo proprio, que viaja na lista. Isso e o que permite o cartao
// dizer "falta o bruto" antes de alguem abrir a peca.
const FORMATOS_QUE_PEDEM_BRUTO = /reels|v[ií]deo|video|motion|fotografia|foto|stor(?:y|ies)|tiktok|audiovisual/i;
function pedeMaterialBruto(item) {
  return FORMATOS_QUE_PEDEM_BRUTO.test(String(item?.formato || item?.tipo_conteudo || item?.tipo || ''));
}

// Prontidão é disponibilidade de insumos, independente do status da atividade.
function prontidaoDaAtividade(item = {}) {
  const briefing = item.tem_briefing;
  const formato = String(item.formato || item.tipo_conteudo || item.tipo || '').trim();
  const formatoConhecido = Boolean(formato && formato !== '—');
  const pedeBruto = pedeMaterialBruto(item);
  const brutoConhecido = typeof item.material_bruto === 'string';
  const faltas = [];
  if (briefing === false) faltas.push('briefing');
  if (pedeBruto && brutoConhecido && !item.material_bruto.trim()) faltas.push('bruto');
  const verificar = typeof briefing !== 'boolean' || !formatoConhecido || (pedeBruto && !brutoConhecido);
  return { faltas, verificar, pronta: !faltas.length && !verificar };
}
function prontidaoDaAtividadeHtml(item) {
  // Aprovação e publicação têm suas próprias conferências. Este aviso pertence
  // à preparação/execução, onde ainda é possível completar os insumos.
  if (!['Pode Fazer','A Fazer','Em andamento','Falta Info','Ag. Info Cliente','Aguardo','Alteração','Aguardo Redação','Falta OFF'].includes(operationalFlowStatus(item))) return '';
  const estado = prontidaoDaAtividade(item);
  const id = safeText(String(item.id));
  const acoes = estado.faltas.map(falta => falta === 'briefing'
    ? `<button type="button" onclick="event.stopPropagation();abrirBriefing('${id}',this)">Falta briefing</button>`
    : `<button type="button" onclick="event.stopPropagation();abrirMaterialBruto('${id}',event)">Falta material bruto</button>`);
  if (estado.verificar) acoes.push(`<button type="button" onclick="event.stopPropagation();openItemWorkspace('${id}')">Verificar informações</button>`);
  return `<div class="focus-readiness ${estado.pronta ? 'is-ready' : 'is-pending'}" aria-label="Insumos para produção">${estado.pronta
    ? '<span title="Briefing e material necessário registrados">Pronto para produzir</span>'
    : acoes.join('<span aria-hidden="true">·</span>')}</div>`;
}

// Lista e detalhe recebem o mesmo resgate do servidor, sem gravar a coluna.
function materialBrutoDaPeca(detail, item) {
  const fonte = detail && Object.prototype.hasOwnProperty.call(detail, 'material_bruto') ? detail : item;
  const url = String(fonte?.material_bruto || '').trim();
  return url ? { url, origem: fonte?.material_bruto_origem || 'campo', quando: fonte?.material_bruto_em || '' } : null;
}

async function gravarMaterialBruto(itemId, link) {
  const resposta = await fetch('/api/conteudo', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao: 'material_bruto', item: String(itemId), link: String(link || '') }),
  });
  const dados = await resposta.json();
  if (!resposta.ok || !dados.ok) throw new Error(dados?.error || 'Não foi possível salvar.');
  // A lista e a gaveta leem de lugares diferentes; sem os dois, o cartao continua
  // dizendo que falta material logo depois de alguem registrar.
  [DADOS, DADOS_ALL, DADOS_DEMANDAS].forEach(lista => (lista || []).forEach(item => {
    if (String(item.id) === String(itemId)) item.material_bruto = dados.para || '';
  }));
  saveProductionCache();
  if (DETALHE_DA_GAVETA && String(DETALHE_DA_GAVETA.id ?? '') === String(itemId)) {
    DETALHE_DA_GAVETA.material_bruto = dados.para || '';
    DETALHE_DA_GAVETA.material_bruto_origem = 'campo';
  }
  return dados;
}

// Pedir o link, gravar e redesenhar o que estiver aberto. Um caminho so, chamado
// do cartao, da gaveta e da tela de briefing.
async function pedirMaterialBruto(itemId, event) {
  event?.stopPropagation?.();
  const item = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  const atual = String(item?.material_bruto || '');
  const url = await perguntarNoPainel({
    titulo: atual ? 'Trocar o link do material bruto' : 'Link do material bruto',
    texto: 'A pasta com o que foi captado — os vídeos e fotos que quem edita precisa baixar. '
      + 'Aparece na tela de briefing, que é onde quem produz vai procurar.',
    campo: { valor: atual, dica: 'https://drive.google.com/drive/folders/…' },
    confirmar: atual ? 'Trocar link' : 'Registrar link',
  });
  if (url === null || url === undefined) return;
  const drawer = document.getElementById('workspace-drawer');
  let confirmado = false;
  try {
    const feito = await gravarMaterialBruto(itemId, url);
    confirmado = true;
    showToast(feito.para ? '✓ Material bruto registrado' : '✓ Link do material bruto removido', 'ok', 4000);
    renderOutboundItemPatch('material bruto');
    await atualizarGavetaPreservandoRascunhos(findOperationalItem(itemId) || {id:itemId}, drawer);

    if (document.getElementById('brief-overlay') && BRIEFING_ABERTO?.item
        && String(BRIEFING_ABERTO.item.id) === String(itemId)) {
      fecharBriefing(); await abrirBriefing(itemId);
    }
  } catch (erro) { showToast(confirmado ? 'Link salvo. Não foi possível atualizar os detalhes; reabra a atividade.' : `Não foi possível salvar: ${erro.message}`, confirmado ? 'info' : 'err', 7000); }
}

// Guardar no campo o link que a tela achou no historico. E a migracao das pecas
// antigas feita uma peca por vez, por quem esta olhando para ela — e nao uma
// varredura adivinhando qual link de qual atualizacao era o material bruto.
async function fixarMaterialBruto(itemId, url, event) {
  event?.stopPropagation?.();
  const drawer = document.getElementById('workspace-drawer');
  let confirmado = false;
  try {
    await gravarMaterialBruto(itemId, url);
    confirmado = true;
    showToast('✓ Link fixado no campo · o cartão para de cobrar', 'ok', 4000);
    renderOutboundItemPatch('material bruto');
    await atualizarGavetaPreservandoRascunhos(findOperationalItem(itemId) || {id:itemId}, drawer);

    if (document.getElementById('brief-overlay') && BRIEFING_ABERTO?.item
        && String(BRIEFING_ABERTO.item.id) === String(itemId)) {
      fecharBriefing(); await abrirBriefing(itemId);
    }
  } catch (erro) { showToast(confirmado ? 'Link salvo. Não foi possível atualizar os detalhes; reabra a atividade.' : `Não foi possível fixar: ${erro.message}`, confirmado ? 'info' : 'err', 7000); }
}

// Clicar no botao do cartao: se tem link, abre; se nao tem, pergunta. Um botao
// que as vezes abre e as vezes pede e melhor do que dois botoes que se alternam.
function abrirMaterialBruto(itemId, event) {
  event?.stopPropagation?.();
  const item = typeof findOperationalItem === 'function' ? findOperationalItem(itemId) : null;
  if (typeof item?.material_bruto !== 'string') return openItemWorkspace(itemId);
  const url = String(item.material_bruto || '');
  if (!url) return pedirMaterialBruto(itemId, event);
  window.open(url, '_blank', 'noopener');
}

function botaoDeMaterialBrutoHtml(item, proxima = false) {
  if (!pedeMaterialBruto(item)) return '';
  const conhecido = typeof item.material_bruto === 'string';
  const tem = Boolean(String(item.material_bruto || '').trim());
  const rotulo = !conhecido ? 'Consultar bruto' : tem ? (proxima ? 'Material bruto' : 'Bruto') : 'Sem bruto';
  return `<button type="button" class="${proxima ? 'focus-next-btn brief' : 'focus-brief-btn bruto'}${conhecido && !tem ? ' faltando' : ''}"
    onclick="abrirMaterialBruto('${safeText(String(item.id))}',event)"
    title="${!conhecido ? 'Consultar material da atividade' : tem ? 'Abrir a pasta com o material captado' : 'Nenhum material bruto registrado · clique para colar o link da pasta'}"
    aria-label="${rotulo}">${ICONE_LINHA.bruto}<span>${rotulo}</span></button>`;
}

// A faixa na tela de briefing e na gaveta. E o mesmo desenho nos dois lugares
// porque e a mesma informacao — e porque quem produz aprende um lugar so.
function faixaDeMaterialBrutoHtml(detail, item, { compacta = false } = {}) {
  const bruto = materialBrutoDaPeca(detail, item);
  if (!bruto) {
    if (!pedeMaterialBruto(item)) return '';
    return `<div class="material-bruto faltando">
      <div class="material-bruto-copy"><span>Material bruto</span>
        <b>Nenhuma pasta registrada</b>
        <small>Quem edita não tem o que baixar. Cole aqui o link da pasta com o que foi captado.</small></div>
      <div class="material-bruto-acoes">
        <button type="button" class="material-bruto-add" onclick="pedirMaterialBruto('${safeText(String(item.id))}',event)">REGISTRAR LINK</button>
      </div></div>`;
  }
  const quando = String(bruto.quando || '').replace('T', ' ').slice(0, 16);
  return `<div class="material-bruto">
    <div class="material-bruto-copy"><span>Material bruto${bruto.origem === 'histórico' ? ' · encontrado no histórico' : ''}</span>
      <b>Pasta do material captado</b>
      <small>${safeText(bruto.url.replace(/^https?:\/\//, '').slice(0, 64))}${bruto.url.length > 71 ? '…' : ''}${quando ? ` · ${safeText(quando)}` : ''}</small></div>
    <div class="material-bruto-acoes">
      <a class="material-bruto-abrir" href="${safeText(bruto.url)}" target="_blank" rel="noopener">ABRIR PASTA ↗</a>
      <button type="button" class="material-bruto-copiar" onclick="copiarBriefingTexto('${safeText(bruto.url)}','Link do material bruto')">Copiar</button>
      ${compacta ? '' : (bruto.origem === 'histórico'
        // Fixar promove o resgate histórico ao campo explícito da peça.
        ? `<button type="button" class="material-bruto-copiar" onclick="fixarMaterialBruto('${safeText(String(item.id))}','${safeText(bruto.url)}',event)"
             title="Guardar este link no campo da peça">Fixar</button>`
        : `<button type="button" class="material-bruto-copiar" onclick="pedirMaterialBruto('${safeText(String(item.id))}',event)">Trocar</button>`)}
    </div></div>`;
}
